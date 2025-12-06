import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import ReactDOM from "react-dom/client";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate, useParams, useSearchParams, useOutletContext } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

import RatingModal from "../components/RatingModal";
import UpgradeModal from "../components/UpgradeModal";
import ReportIssueModal from "../models/ReportIssueModal";
import CreateWatchRoomModal from "../models/CreateWatchRoomModal";
import AuthorService from "../services/AuthorService";
import EpisodeService from "../services/EpisodeService";
import MovieService from "../services/MovieService";
import WishlistService from "../services/WishlistService";

import videojs from "video.js";
import "video.js/dist/video-js.css";
import "videojs-contrib-quality-levels";
import "videojs-hls-quality-selector";

import { Funnel } from "lucide-react";
import { faHeart, faPlus, faFlag, faShareNodes, faCirclePlay, faEye, faClockRotateLeft, faBackwardStep, faForwardStep, faGear } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import "../css/WatchPage.css";
import { initAntiCapture } from "../utils/antiCapture";
import { parseWatchUrl, createWatchUrl } from "../utils/urlUtils";
import SubtitleService from "../services/SubtitleService";

/* import phần bình luận */
import { toast } from "react-toastify";
import FeedbackService from "../services/FeedbackService";
import default_avatar from "../image/default_avatar.jpg";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/vi";
import { buildFeedbackTree, FeedbackItem } from "../components/FeedbackItem";
dayjs.extend(relativeTime);
dayjs.locale("vi");

export default function WatchPage() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const [searchParams] = useSearchParams();
  const { MyUser } = useAuth();
  const outletContext = useOutletContext() || {};
  const { setWatchPageMovieId } = outletContext;

  // -------- URL parsing (ID + Slug support)
  const isSlugFormat = !params.movieId; // If no movieId, then it's slug format
  const urlMovieId = params.movieId || null;
  const urlEpisodeId = params.episodeId || null;
  const movieSlug = params.movieSlug || null;
  const episodeSlug = params.episodeSlug || null;
  const refParam = searchParams.get("ref");

  let urlData = null;
  if (isSlugFormat) {
    urlData = parseWatchUrl(movieSlug, episodeSlug, refParam);
  } else {
    urlData = { movieId: urlMovieId, episodeId: urlEpisodeId };
  }

  // -------- state từ navigate
  const episodeFromState = state?.episode || null;
  const movieFromState = state?.movie || null;

  // -------- global states
  const [isInWishlist, setIsInWishlist] = useState(false);
  const userId = MyUser?.my_user?.userId ?? null;

  const [seasons, setSeasons] = useState(state?.seasons || []);
  const [selectedSeason, setSelectedSeason] = useState(seasons[0] || null);
  const [epsOfSeason, setEpsOfSeason] = useState(state?.episodes || []);
  const [authors, setAuthors] = useState(state?.authors || []);

  const [showRatingModal, setShowRatingModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showCreateRoomModal, setShowCreateRoomModal] = useState(false);
  const [ratings, setRatings] = useState([]);

  // current movie/episode (nguồn sự thật)
  const [currentEpisode, setCurrentEpisode] = useState(episodeFromState);
  const [currentMovie, setCurrentMovie] = useState(movieFromState);
  const [dataLoading, setDataLoading] = useState(!episodeFromState || !movieFromState);
  const [suggestedMovies, setSuggestedMovies] = useState([]);

  // Gate kiểm tra quyền VIP
  const [gate, setGate] = useState({ checking: true, allowed: false, message: "" });

  // Trial mode states
  const [isTrialMode, setIsTrialMode] = useState(false);
  // trialTimeLimit is in seconds. Change to 180 for 3 minutes or 300 for 5 minutes.
  const [trialTimeLimit] = useState(180); // thời gian xem thử (3 phút)
  const [currentTime, setCurrentTime] = useState(0);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [trialExpired, setTrialExpired] = useState(false);

  // Package name mapping
  const getPackageDisplayName = (minVipLevel) => {
    const packageMap = {
      'NO_ADS': 'NO ADS',
      'PREMIUM': 'PREMIUM',
      'MEGA_PLUS': 'MEGA+',
      'COMBO_PREMIUM_MEGA_PLUS': 'COMBO PREMIUM'
    };
    return packageMap[minVipLevel] || minVipLevel;
  };

  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []); // Empty dependency array means this runs once on mount

  //  Also scroll to top when episode changes or data loading completes
  useEffect(() => {
    if (currentEpisode?.episodeId && !dataLoading) {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [currentEpisode?.episodeId, dataLoading]);

  // -------- Video Settings States
  const [playbackRate, setPlaybackRate] = useState(1);
  const [selectedQuality, setSelectedQuality] = useState('Auto (720p)');
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [currentSettingsView, setCurrentSettingsView] = useState('main'); // 'main', 'speed', 'quality', 'subtitle'

  // -------- Player Element for Portal
  const [playerEl, setPlayerEl] = useState(null);

  // -------- Subtitle States
  const [availableSubtitles, setAvailableSubtitles] = useState([]);
  const [selectedSubtitle, setSelectedSubtitle] = useState(null);
  const [loadingSubtitles, setLoadingSubtitles] = useState(false);

  // Toggle this to allow autoplay on page load. Default: false (do not autoplay)
  const allowAutoplay = false;


  // -------- computed
  const totalRatings = ratings.length;
  const avgRating = totalRatings
    ? ratings.reduce((s, r) => s + (Number(r.rating) || 0), 0) / totalRatings
    : 0;

  const movieId =
    currentMovie?.movieId || movieFromState?.movieId || urlData?.movieId || urlMovieId || null;

  // Khi có state từ navigate, đồng bộ vào current*
  useEffect(() => {
    if (state?.episode) setCurrentEpisode(state.episode);
    if (state?.movie) setCurrentMovie(state.movie);
    if (state?.episodes?.length) setEpsOfSeason(state.episodes);
    if (state?.seasons?.length) setSeasons(state.seasons);
  }, [state?.episode?.episodeId, state?.movie?.movieId]);

  // ✅ Truyền movieId lên Layout để ChatBox biết phim đang xem
  useEffect(() => {
    if (currentMovie?.movieId && setWatchPageMovieId) {
      setWatchPageMovieId(currentMovie.movieId);
    }
    return () => {
      if (setWatchPageMovieId) setWatchPageMovieId(null);
    };
  }, [currentMovie?.movieId, setWatchPageMovieId]);

  // ✅ Kiểm tra quyền VIP khi có currentMovie
  useEffect(() => {
    (async () => {
      if (!currentMovie?.movieId) return;

      // Reset trial states khi đổi phim
      setIsTrialMode(false);
      setTrialExpired(false);
      setCurrentTime(0);
      setShowUpgradeModal(false);

      const required = currentMovie.minVipLevel || "FREE";

      // ✅ ALWAYS CHECK BACKEND FIRST - Luôn kiểm tra quyền thực tế với BE
      try {
        const res = await MovieService.canWatch(currentMovie.movieId, userId);

        if (res.allowed) {
          setIsTrialMode(false);
          setGate({ status: 'allowed', message: "" });
          return;
        } else {
          // Nếu phim FREE mà không được phép xem thì chặn hoàn toàn
          if (required === "FREE") {
            setGate({
              status: 'not_allowed',
              message: res.message || "Bạn chưa đủ quyền xem phim này."
            });
            return;
          }

          // Nếu phim VIP mà không có quyền thì cho trial mode
          const packageName = getPackageDisplayName(required);
          setIsTrialMode(true);
          setGate({
            status: 'trial',
            message: `Đang xem thử phim ${packageName} - ${trialTimeLimit} giây miễn phí`,
            requiredPackage: packageName
          });
        }
      } catch (error) {
        console.error("VIP check error:", error);

        // Fallback logic based on movie type
        if (required === "FREE") {
          setGate({ status: 'allowed', message: "" });
        } else {
          const packageName = getPackageDisplayName(required);
          setIsTrialMode(true);
          setGate({
            status: 'trial',
            message: `Đang xem thử phim ${packageName} - ${trialTimeLimit} giây miễn phí`,
            requiredPackage: packageName
          });
        }
      }
    })();
  }, [currentMovie?.movieId, userId]);

  // -------- Load subtitles for current episode
  useEffect(() => {
    const loadSubtitles = async () => {
      const currentEp = currentEpisode || episodeFromState;
      if (!currentEp?.seasonId || !currentEp?.episodeNumber) {
        setAvailableSubtitles([]);
        return;
      }

      try {
        setLoadingSubtitles(true);
        const subtitles = await SubtitleService.getSubtitles(currentEp.seasonId, currentEp.episodeNumber);
        setAvailableSubtitles(Array.isArray(subtitles) ? subtitles : []);

        // Auto-select default subtitle or first available
        const defaultSub = subtitles.find(sub => sub.isDefault);
        const firstSub = subtitles[0];
        setSelectedSubtitle(defaultSub || firstSub || null);

        if (defaultSub) {
          setSubtitlesEnabled(true);
        }
      } catch (error) {
        console.error('Error loading subtitles:', error);
        setAvailableSubtitles([]);
      } finally {
        setLoadingSubtitles(false);
      }
    };

    loadSubtitles();
  }, [currentEpisode?.episodeId, episodeFromState?.episodeId]);

  // Function to apply subtitles to video player
  const applySubtitlesToPlayer = (player) => {
    if (!availableSubtitles?.length) return;

    // Remove existing subtitle tracks
    const existingTracks = player.textTracks();
    for (let i = existingTracks.length - 1; i >= 0; i--) {
      const track = existingTracks[i];
      if (track.kind === 'subtitles') {
        player.removeRemoteTextTrack(track);
      }
    }

    // Add new subtitle tracks via proxy (SRT→VTT conversion + CORS fix + Content cleaning)
    availableSubtitles.forEach((subtitle, index) => {
      // Use backend proxy to handle CORS, SRT→VTT conversion, and content cleaning
      const proxyUrl = `${process.env.REACT_APP_API_BASE || process.env.REACT_APP_API_BASE_URL}/proxy/subtitle?url=${encodeURIComponent(subtitle.url)}&clean=true`;

      console.log('🎬 Adding subtitle via proxy (with cleaning):', {
        original: subtitle.url,
        proxy: proxyUrl,
        lang: subtitle.lang,
        label: subtitle.label
      });

      player.addRemoteTextTrack({
        kind: 'subtitles',
        src: proxyUrl,
        srclang: subtitle.lang,
        label: subtitle.label,
        default: subtitle.isDefault || index === 0
      }, false);
    });

    // Auto-select default subtitle if available
    if (selectedSubtitle) {
      setTimeout(() => {
        const tracks = player.textTracks();
        for (let i = 0; i < tracks.length; i++) {
          const track = tracks[i];
          if (track.language === selectedSubtitle.lang) {
            track.mode = 'showing';
          } else {
            track.mode = 'disabled';
          }
        }
      }, 500);
    }
  };

  // Apply subtitles when available subtitles change
  useEffect(() => {
    if (playerRef.current && availableSubtitles?.length > 0) {
      applySubtitlesToPlayer(playerRef.current);
    }
  }, [availableSubtitles, selectedSubtitle]);

  // -------- fetch bằng URL khi không có state
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const targetMovieId = params.movieId || urlData?.movieId;
      const targetEpisodeId = params.episodeId || urlData?.episodeId;

      if (targetMovieId && targetEpisodeId) {
        setDataLoading(true);
        try {
          const [epData, mvData] = await Promise.all([
            EpisodeService.getEpisodeById(targetEpisodeId),
            MovieService.getMovieDetail(targetMovieId),
          ]);
          if (cancelled) return;

          setCurrentEpisode(epData);
          setCurrentMovie(mvData?.movie || mvData);

          const arr = Array.isArray(mvData?.seasons) ? mvData.seasons : [];
          setSeasons(arr);
          const curSeason = arr.find((s) => s.episodes?.some((ep) => ep.episodeId === targetEpisodeId));
          if (curSeason) {
            setSelectedSeason(curSeason);
            setEpsOfSeason(curSeason.episodes || []);
          }
        } catch (e) {
          console.error("Error fetching by ID:", e);
        } finally {
          if (!cancelled) setDataLoading(false);
        }
        return;
      }

      // Slug branch: implement later if needed
    };

    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.movieId, params.episodeId, isSlugFormat, urlData?.movieId, urlData?.episodeId]);

  // -------- tải tác giả (cast)
  useEffect(() => {
    (async () => {
      if (!movieId) return;
      if (authors?.length) return;
      try {
        const list = await AuthorService.getAuthorsByMovieId(movieId);
        setAuthors(Array.isArray(list) ? list : []);
      } catch { }
    })();
  }, [movieId, authors?.length]);

  // -------- tải phim đề xuất (dùng BE)
  useEffect(() => {
    (async () => {
      if (!movieId) return;
      try {
        const recs = await MovieService.getRecommendations(movieId, 6);
        setSuggestedMovies(Array.isArray(recs) ? recs : []);
      } catch (err) {
        console.error("Error fetching recommendations:", err);
        setSuggestedMovies([]);
      }
    })();
  }, [movieId]);

  // -------- tải ratings
  useEffect(() => {
    (async () => {
      if (!movieId) return;
      try {
        const list = await MovieService.getAllMovieRatings(movieId);
        setRatings(Array.isArray(list) ? list : []);
      } catch { }
    })();
  }, [movieId]);

  // -------- Seasons + episodes theo season (nếu chưa có từ state)
  useEffect(() => {
    (async () => {
      if (!movieId) return;
      try {
        if (!seasons.length) {
          const detail = await MovieService.getMovieDetail(movieId);
          const arr = Array.isArray(detail?.seasons) ? detail.seasons : [];
          setSeasons(arr);
          const first = arr[0] || null;
          setSelectedSeason(first);
          if (first?.seasonId) {
            const eps = await EpisodeService.getEpisodesBySeasonId(first.seasonId);
            const episodeArray = Array.isArray(eps) ? eps : [];
            setEpsOfSeason(episodeArray);
          } else {
            setEpsOfSeason([]);
          }
        } else if (!epsOfSeason.length && selectedSeason?.seasonId) {
          const eps = await EpisodeService.getEpisodesBySeasonId(selectedSeason.seasonId);
          setEpsOfSeason(Array.isArray(eps) ? eps : []);
        }
      } catch { }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movieId]);

  const handlePickSeason = async (s) => {
    setSelectedSeason(s);
    try {
      const eps = await EpisodeService.getEpisodesBySeasonId(s.seasonId);
      setEpsOfSeason(Array.isArray(eps) ? eps : []);
    } catch {
      setEpsOfSeason([]);
    }
  };

  // -------- Wishlist
  useEffect(() => {
    const checkWishlist = async () => {
      if (!userId || !movieId) return;
      const exists = await WishlistService.existsInWishlist(userId, movieId);
      setIsInWishlist(exists);
    };
    checkWishlist();
  }, [userId, movieId]);

  const handleToggleWishlist = async () => {
    if (!movieId) return;
    try {
      if (isInWishlist) {
        await WishlistService.removeFromWishlist(userId, movieId);
        toast.success("Đã xóa khỏi danh sách yêu thích");
        setIsInWishlist(false);
      } else {
        await WishlistService.addToWishlist(userId, movieId);
        toast.success("Đã thêm vào danh sách yêu thích");
        setIsInWishlist(true);
      }
    } catch (error) {
      console.error("Lỗi thao tác wishlist:", error);
      toast.error("Thao tác thất bại");
    }
  };




  // Cấu hình ad (có thể lấy từ BE, file JSON, hoặc AB test)
  const PREROLL_CONFIG = {
    src: "https://web-app-cartoontoo.s3.ap-southeast-1.amazonaws.com/inputs/M%C3%8C+SIUKAY+TUNG+PHI%C3%8AN+B%E1%BA%A2N+GI%E1%BB%9AI+H%E1%BA%A0N+M%C3%99A+HALLOWEEN+V%E1%BB%9AI+G%C3%93I+%E1%BB%9AT+MA+M%E1%BB%9AI+-+CAY+T%E1%BB%98T+%C4%90%E1%BB%88NH%2C+B%C3%99NG+B%E1%BA%A2N+L%C4%A8NH.mp4", // MP4/HLS đều được
    skipAfterSeconds: 3,
    frequencyMinutes: 0, // không spam: tối thiểu cách nhau X phút
  };

  // eligibility: user chưa login hoặc gói FREE
  const isFreeOrGuest = !MyUser?.my_user || MyUser?.my_user?.packageType === "FREE";


  // preroll ad states
  const [showPreroll, setShowPreroll] = useState(false);
  const [canSkip, setCanSkip] = useState(false);
  const [skipLeft, setSkipLeft] = useState(PREROLL_CONFIG.skipAfterSeconds);
  const adVideoRef = useRef(null);
  const skipTimerRef = useRef(null);

  // Gọi lại mỗi khi đổi episode
  useEffect(() => {
    // chỉ chạy khi gate cho xem (allowed/trial)
    if (!['allowed', 'trial'].includes(gate.status)) return;

    // chỉ hiện khi guest hoặc FREE
    if (!isFreeOrGuest) return;

    // có nguồn ad không?
    if (!PREROLL_CONFIG.src) return;

    // tần suất
    const key = "preroll_last_seen_at";
    let okByFrequency = true;
    try {
      const last = Number(sessionStorage.getItem(key) || 0);
      const minutes = (Date.now() - last) / 60000;
      okByFrequency = minutes >= (PREROLL_CONFIG.frequencyMinutes || 0);
    } catch { }

    if (!okByFrequency) return;

    // bật ad
    setShowPreroll(true);
    setCanSkip(false);
    setSkipLeft(PREROLL_CONFIG.skipAfterSeconds);

    // chặn player chính
    try { playerRef.current?.pause(); } catch { }

    // đếm ngược mở Skip
    clearInterval(skipTimerRef.current);
    skipTimerRef.current = setInterval(() => {
      setSkipLeft((s) => {
        if (s <= 1) {
          clearInterval(skipTimerRef.current);
          setCanSkip(true);
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    // cleanup khi đổi tập/unmount
    return () => {
      clearInterval(skipTimerRef.current);
    };
  }, [currentEpisode?.episodeId, gate.status, isFreeOrGuest]);
  // Pause/mute main player while preroll is showing
  useEffect(() => {
    const p = playerRef.current;
    if (!p) return;

    if (showPreroll) {
      try {
        p.pause();
        p.muted(true);              // chắc chắn không “song song” tiếng
        p.addClass('is-preroll');   // để CSS ẩn control, chặn click
      } catch { }
      // đảm bảo video ad bắt đầu từ đầu và play
      const adv = adVideoRef.current;
      if (adv) {
        try { adv.currentTime = 0; } catch { }
        adv.play().catch(() => { });
      }
    } else {
      // trả lại bình thường
      try {
        p.muted(false);
        p.removeClass('is-preroll');
      } catch { }
    }
  }, [showPreroll]);


  const startMainPlayback = () => {
    setShowPreroll(false);
    clearInterval(skipTimerRef.current);
    const p = playerRef.current;
    if (p) setTimeout(() => p.play().catch(() => { }), 50);
  };

  const handleAdEnded = () => {
    // kết thúc quảng cáo -> phát nội dung chính
    startMainPlayback();
  };

  const handleAdError = (e) => {
    console.error("Preroll error", e);
    // lỗi quảng cáo thì bỏ qua luôn để không kẹt màn đen
    startMainPlayback();
  };

  const handleSkipAd = () => {
    if (!canSkip) return;
    try {
      const v = adVideoRef.current;
      if (v) {
        v.pause();
        v.removeAttribute('src'); // ngắt tải
        v.load();
      }
    } catch { }
    startMainPlayback();
  };
  // đánh dấu đã xem quảng cáo (để tính frequency)
  const markAdSeen = useCallback(() => {
    try {
      sessionStorage.setItem("preroll_last_seen_at", String(Date.now()));
    } catch { }
  }, []);




  // -------- Bình luận
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const size = 10;
  const [totalPages, setTotalPages] = useState(1);
  const [replyTo, setReplyTo] = useState(null);
  const [replyContent, setReplyContent] = useState("");

  const fetchFeedback = useCallback(async () => {
    if (!movieId) return;
    try {
      const { items, totalPages: tp } = await FeedbackService.getListFeedbackByIdMovie(movieId, page, size);
      setComments(buildFeedbackTree(items));
      setTotalPages(tp || 1);
    } catch (error) {
      console.error("Lỗi khi lấy dữ liệu phản hồi:", error);
      setComments([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [movieId, page, size]);

  useEffect(() => {
    fetchFeedback();
  }, [fetchFeedback]);

  React.useEffect(() => {
    window.scrollTo({ top: 200, behavior: 'smooth' });
  }, [page]);

  // --- Resume modal helpers
  const formatTimeHuman = (s) => {
    const sec = Number(s) || 0;
    const m = Math.floor(sec / 60);
    const secRem = sec % 60;
    if (m > 0) return `${m} phút ${secRem} giây`;
    return `${secRem} giây`;
  };

  const resumeStorageKey = () => {
    const epId = (currentEpisode || episodeFromState)?.episodeId;
    const mId = movieId;
    if (!mId || !epId) return null;
    return `watch_progress:${mId}:${epId}`;
  };

  const handleResumeContinue = () => {
    const p = playerRef.current;
    const key = resumeStorageKey();
    setShowResumeModal(false);
    if (p) {
      try { p.currentTime(Number(resumeTime) || 0); } catch (e) { }
      p.play().catch(() => { });
    }
    lastSavedRef.current = Number(resumeTime) || 0;
  };

  const handleResumeRestart = () => {
    const p = playerRef.current;
    const key = resumeStorageKey();
    try { if (key) sessionStorage.removeItem(key); } catch (e) { }
    setShowResumeModal(false);
    if (p) {
      try { p.currentTime(0); } catch (e) { }
      p.play().catch(() => { });
    }
    lastSavedRef.current = 0;
  };

  const handleDismissResume = () => {
    setShowResumeModal(false);
  };

  const goTo = (p) => {
    if (p < 0 || p >= totalPages || loading) return;
    setPage(p);
  };

  // current: số trang hiện tại (0-based); total: tổng số trang; siblings: số trang mỗi bên
  const getPageItems = (total, current, siblings = 1) => {
    if (total <= 1) return [0];
    const first = 0;
    const last = total - 1;

    const start = Math.max(current - siblings, first + 1);
    const end = Math.min(current + siblings, last - 1);

    const items = [first];

    if (start > first + 1) items.push('ellipsis-left');
    for (let i = start; i <= end; i++) items.push(i);
    if (end < last - 1) items.push('ellipsis-right');

    if (last > first) items.push(last);
    return items;
  };

  const pageItems = React.useMemo(() => getPageItems(totalPages, page, 1), [totalPages, page]);

  const handleSendReply = async (parentFb) => {
    try {
      const payload = {
        userId,
        movieId: movieId,
        content: replyContent,
        parentFeedbackId: parentFb.feedbackId,
      };
      await FeedbackService.submitFeedback(payload);
      toast.success("Trả lời thành công!");
      setReplyContent("");
      setReplyTo(null);
      await fetchFeedback();
    } catch (err) {
      console.error(err);
      toast.error("Gửi trả lời thất bại");
    }
  };

  // tạo feedback
  const handleFeedbackSubmit = async () => {
    if (!comment.trim()) {
      toast.error("Nội dung không được để trống");
      return;
    }

    if (!movieId) {
      toast.error("Không tìm thấy movieId");
      return;
    }

    if (!userId) {
      toast.error("Bạn cần đăng nhập để bình luận");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        userId,
        movieId: movieId,
        content: comment,
        parentFeedbackId: replyTo ? replyTo.feedbackId : null
      };
      await FeedbackService.submitFeedback(payload);
      toast.success("Gửi bình luận thành công!");
      setComment("");
      setReplyTo(null);
      await fetchFeedback();
    } catch (error) {
      console.error(error);
      toast.error("Gửi bình luận thất bại");
    } finally {
      setSubmitting(false);
    }
  };

  // like feedback
  const handleLikeFeedback = async (feedbackId) => {
    if (!userId) {
      toast.error("Bạn cần đăng nhập để thực hiện thao tác này");
      return;
    }
    try {
      await FeedbackService.likeFeedback(feedbackId, userId);
      // Cập nhật lại danh sách feedback
      await fetchFeedback();
    } catch (error) {
      console.error("Lỗi khi thích phản hồi:", error);
      toast.error("Thao tác thất bại");
    }
  };

  // dislike feedback
  const handleDislikeFeedback = async (feedbackId) => {
    if (!userId) {
      toast.error("Bạn cần đăng nhập để thực hiện thao tác này");
      return;
    }
    try {
      await FeedbackService.dislikeFeedback(feedbackId, userId);
      // Cập nhật lại danh sách feedback
      await fetchFeedback();
    } catch (error) {
      console.error("Lỗi khi không thích phản hồi:", error);
      toast.error("Thao tác thất bại");
    }
  };

  // -------- nextEp với preloading
  const nextEp = useMemo(() => {
    const cur = currentEpisode || episodeFromState;
    if (!cur || !epsOfSeason?.length) return null;
    const idx = epsOfSeason.findIndex((e) => e.episodeId === cur.episodeId);
    const next = idx >= 0 && idx + 1 < epsOfSeason.length ? epsOfSeason[idx + 1] : null;

    return next;
  }, [currentEpisode, episodeFromState, epsOfSeason]);

  // -------- prevEp
  const prevEp = useMemo(() => {
    const cur = currentEpisode || episodeFromState;
    if (!cur || !epsOfSeason?.length) return null;
    const idx = epsOfSeason.findIndex(e => e.episodeId === cur.episodeId);
    return idx > 0 ? epsOfSeason[idx - 1] : null;
  }, [currentEpisode, episodeFromState, epsOfSeason]);

  // -------- Player refs & UI states
  const playerRef = useRef(null);
  const videoRef = useRef(null);
  const antiCapCleanupRef = useRef(null);

  // CloudFront optimized URL state
  const [optimizedUrl, setOptimizedUrl] = useState(null);

  const frameRef = useRef(null);
  const [playerH, setPlayerH] = useState(0);

  // --- Resume / save-progress states (so reloading or returning shows resume modal)
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [resumeTime, setResumeTime] = useState(0);
  const lastSavedRef = useRef(0);

  // refs cho nút trên control bar
  const prevBtnRef = useRef(null);
  const nextBtnRef = useRef(null);
  const rewind10BtnRef = useRef(null);
  const forward10BtnRef = useRef(null);
  const settingsBtnRef = useRef(null);

  // giữ “bản mới nhất” của prev/next để callback trong Video.js luôn đúng
  const prevEpRef = useRef(null);
  const nextEpRef = useRef(null);
  useEffect(() => { prevEpRef.current = prevEp; nextEpRef.current = nextEp; }, [prevEp, nextEp]);

  const endedHandlerRef = useRef(null);

  const goToEp = (ep) => {
    if (!ep) return;
    const cm = currentMovie || movieFromState;
    const url = createWatchUrl(cm, ep);
    navigate(url, { state: { episode: ep, movie: cm, episodes: epsOfSeason, authors, seasons } });
  };

  const goPrev = () => goToEp(prevEpRef.current);
  const goNext = () => goToEp(nextEpRef.current);


  const [isTheater, setIsTheater] = useState(false);
  const [autoNext, setAutoNext] = useState(true);
  const [sticky, setSticky] = useState(false);
  const [inList, setInList] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);

  // đo chiều cao khung player (cho placeholder khi sticky)
  useEffect(() => {
    const measure = () => {
      if (frameRef.current) {
        setPlayerH(frameRef.current.getBoundingClientRect().height || 0);
      }
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // -------- Init Video.js KHI video element đã render (gate allowed hoặc trial)
  useEffect(() => {
    // Chỉ init khi gate allowed/trial và video element tồn tại
    if (!['allowed', 'trial'].includes(gate.status) || !videoRef.current || playerRef.current) return;

    // ✅ Set crossorigin BEFORE initializing video.js
    if (videoRef.current) {
      videoRef.current.setAttribute('crossorigin', 'anonymous');
    }

    const p = videojs(videoRef.current, {
      controls: true,
      autoplay: false, // prevent automatic playback on init
      preload: "auto",
      fluid: true,
      responsive: true,
      html5: { vhs: { overrideNative: false } },
    });

    //vì có nút option nên thời cmt 
    //p.hlsQualitySelector?.({ displayCurrentQuality: false });

    p.on('error', (e) => console.error('Video error:', e));

    // ✅ NEW: Trial mode timer
    if (gate.status === 'trial' && isTrialMode) {
      p.on('timeupdate', () => {
        const time = p.currentTime();
        setCurrentTime(time);

        if (time >= trialTimeLimit && !trialExpired) {
          p.pause();
          setTrialExpired(true);
          setShowUpgradeModal(true);
        }
      });
    }

    // anti-capture
    antiCapCleanupRef.current?.();
    antiCapCleanupRef.current = initAntiCapture(p);

    playerRef.current = p;

    // ✅ Capture player element for Portal
    setPlayerEl(p.el());

    return () => {
      antiCapCleanupRef.current?.();
      antiCapCleanupRef.current = null;
      try {
        p.dispose();
      } catch { }
      playerRef.current = null;
      setPlayerEl(null);
    };
  }, [gate.status, isTrialMode, trialTimeLimit, trialExpired]); // Trigger khi gate status thay đổi

  // -------- Mỗi khi đổi tập: chỉ đổi source (chỉ khi gate allowed hoặc trial)
  useEffect(() => {
    // Chỉ setup video khi gate đã cho phép hoặc trial mode
    if (!['allowed', 'trial'].includes(gate.status)) {
      return;
    }

    const originalUrl = (currentEpisode || episodeFromState)?.videoUrl;
    const p = playerRef.current;

    if (!originalUrl) {
      console.error("❌ No video URL found!");
      return;
    }

    if (!p) {
      console.error("❌ Video player not initialized!");
      return;
    }

    // Use video URL directly 
    setOptimizedUrl(originalUrl); // Update state

    // Test URL trước khi set
    fetch(originalUrl, { method: 'HEAD' })
      .then(response => {
        if (!response.ok) {
          console.error("❌ Video URL not accessible:", response.status);
        }
      })
      .catch(err => console.error("❌ Video URL fetch failed:", err));

    p.pause();
    p.src({ src: originalUrl, type: "application/x-mpegURL" });
    p.load(); // Force load the new source

    // --- Apply subtitles to video player
    setTimeout(() => {
      applySubtitlesToPlayer(p);
    }, 1000); // Wait for video to be ready

    // --- Attach a throttled timeupdate handler to save progress every 5s
    const onTimeUpdate = () => {
      try {
        const t = Math.floor(p.currentTime() || 0);
        const epId = (currentEpisode || episodeFromState)?.episodeId;
        const mId = movieId;
        if (!mId || !epId) return;
        const last = lastSavedRef.current || 0;
        if (t - last >= 5) {
          const key = `watch_progress:${mId}:${epId}`;
          sessionStorage.setItem(key, JSON.stringify({ time: t, updatedAt: Date.now() }));
          lastSavedRef.current = t;
        }
      } catch (e) { /* ignore storage errors */ }
    };

    p.off('timeupdate', onTimeUpdate);
    p.on('timeupdate', onTimeUpdate);

    // Remove saved progress on ended
    const onEndedCleanup = () => {
      try {
        const epId = (currentEpisode || episodeFromState)?.episodeId;
        const mId = movieId;
        if (!mId || !epId) return;
        const key = `watch_progress:${mId}:${epId}`;
        sessionStorage.removeItem(key);
      } catch (e) { }
    };
    p.off('ended', onEndedCleanup);
    p.on('ended', onEndedCleanup);

    // If we have saved progress for this movie+episode, pause and ask user if they want to resume
    try {
      const epId = (currentEpisode || episodeFromState)?.episodeId;
      const mId = movieId;
      if (mId && epId) {
        const key = `watch_progress:${mId}:${epId}`;
        const raw = sessionStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          const saved = Number(parsed?.time || 0);
          if (saved > 5) {
            // Pause and show modal to ask user whether to resume
            setResumeTime(saved);
            setShowResumeModal(true);
            p.pause();
            // Do NOT auto-play until user chooses
            return;
          }
        }
      }
    } catch (e) { }

    // Thử play sau khi load (no saved progress)
    // Only auto-play when allowAutoplay is enabled (some browsers block autoplay with sound)
    if (allowAutoplay) {
      setTimeout(() => {
        p.play().catch((error) => {
          console.error("❌ Video play failed:", error);
        });
      }, 500);
    }

    // Cleanup handlers when effect reruns
    return () => {
      try {
        p.off('timeupdate', onTimeUpdate);
        p.off('ended', onEndedCleanup);
      } catch (e) { }
    };
  }, [currentEpisode?.episodeId, episodeFromState?.episodeId, gate.status]); // Thêm gate.status dependency

  // -------- Lắng nghe ended tách riêng, luôn thấy nextEp mới nhất
  useEffect(() => {
    const p = playerRef.current;
    if (!p) return;

    // gỡ handler cũ (nếu có) trước khi gắn handler mới
    if (endedHandlerRef.current) {
      p.off('ended', endedHandlerRef.current);
    }

    const handler = () => {
      if (autoNext && nextEp) {
        const cm = currentMovie || movieFromState;
        const url = createWatchUrl(cm, nextEp);
        navigate(url, {
          state: { episode: nextEp, movie: cm, episodes: epsOfSeason, authors, seasons },
        });
      }
    };

    endedHandlerRef.current = handler;
    p.on('ended', handler);

    return () => {
      if (endedHandlerRef.current) {
        p.off('ended', endedHandlerRef.current);
      }
    };
  }, [autoNext, nextEp?.episodeId, epsOfSeason, seasons, authors, currentMovie?.movieId, movieFromState?.movieId, navigate]);

  //chế độ rạp phim
  useEffect(() => {
    document.body.classList.toggle('theater-mode', isTheater);
    return () => document.body.classList.remove('theater-mode');
  }, [isTheater]);

  // ESC để thoát theater mode
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isTheater) {
        setIsTheater(false);
      }
    };

    if (isTheater) {
      document.addEventListener('keydown', handleKeyDown);
      // Ẩn cursor sau 3s khi không di chuyển trong theater mode
      let cursorTimer;
      const hideCursor = () => {
        document.body.style.cursor = 'none';
      };
      const showCursor = () => {
        document.body.style.cursor = 'default';
        clearTimeout(cursorTimer);
        cursorTimer = setTimeout(hideCursor, 3000);
      };

      document.addEventListener('mousemove', showCursor);
      cursorTimer = setTimeout(hideCursor, 3000);

      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.removeEventListener('mousemove', showCursor);
        clearTimeout(cursorTimer);
        document.body.style.cursor = 'default';
      };
    }
  }, [isTheater]);
  // Cập nhật fluid khi isTheater thay đổi
  useEffect(() => {
    const p = playerRef.current;
    if (!p) return;
    p.fluid(!isTheater);   // Theater: false, Normal: true
  }, [isTheater]);

  // -------- Drag mini-player (sticky)
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const onMouseDown = (e) => {
    setDragging(true);
    setOffset({ x: e.clientX - pos.x, y: e.clientY - pos.y });
  };

  const onMouseMove = (e) => {
    if (dragging) {
      setPos({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    }
  };

  const onMouseUp = () => setDragging(false);

  useEffect(() => {
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging, offset]);

  // -------- Rate submit
  const handleRateSubmit = async (value) => {
    try {
      if (!movieId || !userId) return;
      await MovieService.saveMovieRating(movieId, value, userId);
      const list = await MovieService.getAllMovieRatings(movieId);
      setRatings(Array.isArray(list) ? list : []);
      setShowRatingModal(false);
    } catch (e) {
      toast.error("Đánh giá thất bại");
    }
  };

  const currentEp = currentEpisode || episodeFromState;
  const currentMov = currentMovie || movieFromState;

  // ✅ Settings Menu Component - render bằng Portal vào player
  const SettingsMenu = () => (
    <div className="video-settings-container">
      <div className="settings-menu">
        {currentSettingsView === 'main' && (
          <>
            <div className="settings-header">
              <h4>Cài đặt</h4>
              <button
                className="settings-close"
                onClick={() => {
                  setShowSettingsMenu(false);
                  setCurrentSettingsView('main');
                }}
              >
                ×
              </button>
            </div>

            <div className="settings-section">
              <div className="settings-item" onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setCurrentSettingsView('quality');
              }}>
                <span className="settings-label">Chất lượng</span>
                <div className="settings-value">
                  <span>{selectedQuality}</span>
                  <span className="settings-arrow">›</span>
                </div>
              </div>

              <div className="settings-item" onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setCurrentSettingsView('subtitle');
              }}>
                <span className="settings-label">Phụ đề</span>
                <div className="settings-value">
                  <span>{selectedSubtitle ? selectedSubtitle.label : 'Tắt'}</span>
                  <span className="settings-arrow">›</span>
                </div>
              </div>

              <div className="settings-item" onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setCurrentSettingsView('speed');
              }}>
                <span className="settings-label">Tốc độ</span>
                <div className="settings-value">
                  <span>{playbackRate}x</span>
                  <span className="settings-arrow">›</span>
                </div>
              </div>
            </div>
          </>
        )}

        {currentSettingsView === 'speed' && (
          <>
            <div className="settings-header">
              <button
                className="back-btn"
                onClick={() => setCurrentSettingsView('main')}
              >
                ‹
              </button>
              <h4>Tốc độ phát</h4>
              <button
                className="settings-close"
                onClick={() => {
                  setShowSettingsMenu(false);
                  setCurrentSettingsView('main');
                }}
              >
                ×
              </button>
            </div>
            <div className="speed-options">
              {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map(speed => (
                <div
                  key={speed}
                  className={`speed-option ${playbackRate === speed ? 'active' : ''}`}
                  onClick={() => {
                    setPlaybackRate(speed);
                    const player = playerRef.current;
                    if (player) {
                      player.playbackRate(speed);
                    }
                    setCurrentSettingsView('main');
                  }}
                >
                  {speed}x {speed === 1 && '(Bình thường)'}
                  {playbackRate === speed && <span className="check">✓</span>}
                </div>
              ))}
            </div>
          </>
        )}

        {currentSettingsView === 'quality' && (
          <>
            <div className="settings-header">
              <button
                className="back-btn"
                onClick={() => setCurrentSettingsView('main')}
              >
                ‹
              </button>
              <h4>Chất lượng video</h4>
              <button
                className="settings-close"
                onClick={() => {
                  setShowSettingsMenu(false);
                  setCurrentSettingsView('main');
                }}
              >
                ×
              </button>
            </div>
            <div className="quality-options">
              {['Auto (720p)', 'FHD 1080p', 'HD 720p', '480p', '360p'].map(quality => (
                <div
                  key={quality}
                  className={`quality-option ${selectedQuality === quality ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedQuality(quality);
                    // Apply quality change to player
                    const player = playerRef.current;
                    if (player && player.qualityLevels) {
                      const qualityLevels = player.qualityLevels();

                      if (quality === 'Auto (720p)') {
                        // Enable auto quality selection
                        for (let i = 0; i < qualityLevels.length; i++) {
                          qualityLevels[i].enabled = true;
                        }
                      } else {
                        // Disable auto quality selection first
                        for (let i = 0; i < qualityLevels.length; i++) {
                          qualityLevels[i].enabled = false;
                        }

                        // Enable only the selected quality
                        let targetHeight;
                        if (quality === 'FHD 1080p') targetHeight = 1080;
                        else if (quality === 'HD 720p') targetHeight = 720;
                        else if (quality === '480p') targetHeight = 480;
                        else if (quality === '360p') targetHeight = 360;

                        for (let i = 0; i < qualityLevels.length; i++) {
                          const level = qualityLevels[i];
                          if (level.height === targetHeight) {
                            level.enabled = true;
                            break;
                          }
                        }
                      }
                    }
                    setCurrentSettingsView('main');
                  }}
                >
                  {quality}
                  {selectedQuality === quality && <span className="check">✓</span>}
                </div>
              ))}
            </div>
          </>
        )}

        {currentSettingsView === 'subtitle' && (
          <>
            <div className="settings-header">
              <button
                className="back-btn"
                onClick={() => setCurrentSettingsView('main')}
              >
                ‹
              </button>
              <h4>Phụ đề</h4>
              <button
                className="settings-close"
                onClick={() => {
                  setShowSettingsMenu(false);
                  setCurrentSettingsView('main');
                }}
              >
                ×
              </button>
            </div>
            <div className="subtitle-options">
              {/* Option to turn off subtitles */}
              <div
                className={`subtitle-option ${!selectedSubtitle ? 'active' : ''}`}
                onClick={() => {
                  setSelectedSubtitle(null);
                  setSubtitlesEnabled(false);

                  // Disable all subtitle tracks
                  const player = playerRef.current;
                  if (player) {
                    const tracks = player.textTracks();
                    for (let i = 0; i < tracks.length; i++) {
                      tracks[i].mode = 'disabled';
                    }
                  }
                  setCurrentSettingsView('main');
                }}
              >
                Tắt phụ đề
                {!selectedSubtitle && <span className="check">✓</span>}
              </div>

              {/* Available subtitle tracks */}
              {availableSubtitles.map((subtitle) => (
                <div
                  key={`${subtitle.lang}-${subtitle.label}`}
                  className={`subtitle-option ${selectedSubtitle?.lang === subtitle.lang ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedSubtitle(subtitle);
                    setSubtitlesEnabled(true);

                    // Enable the selected subtitle track
                    const player = playerRef.current;
                    if (player) {
                      const tracks = player.textTracks();
                      for (let i = 0; i < tracks.length; i++) {
                        const track = tracks[i];
                        if (track.language === subtitle.lang) {
                          track.mode = 'showing';
                        } else {
                          track.mode = 'disabled';
                        }
                      }
                    }
                    setCurrentSettingsView('main');
                  }}
                >
                  {subtitle.label}
                  {selectedSubtitle?.lang === subtitle.lang && <span className="check">✓</span>}
                </div>
              ))}

              {/* Loading state */}
              {loadingSubtitles && (
                <div className="subtitle-option loading">
                  <i className="fas fa-spinner fa-spin"></i>
                  Đang tải phụ đề...
                </div>
              )}

              {/* No subtitles available */}
              {!loadingSubtitles && availableSubtitles.length === 0 && (
                <div className="subtitle-option disabled">
                  Không có phụ đề
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );

  useEffect(() => {
    const p = playerRef.current;
    if (!p) return;

    const Button = videojs.getComponent('Button');

    class PrevEpButton extends Button {
      constructor(player, options) {
        super(player, options);
        this.addClass('vjs-prev-ep');
        this.controlText('Tập trước');
      }
      handleClick() { goPrev(); }
    }

    class NextEpButton extends Button {
      constructor(player, options) {
        super(player, options);
        this.addClass('vjs-next-ep');
        this.controlText('Tập sau');
      }
      handleClick() { goNext(); }
    }

    // ⭐ NEW: Nút tua lùi 10 giây
    class Rewind10Button extends Button {
      constructor(player, options) {
        super(player, options);
        this.addClass('vjs-rewind-10');
        this.controlText('Tua lùi 10 giây');
      }
      handleClick() {
        const currentTime = this.player().currentTime();
        this.player().currentTime(Math.max(0, currentTime - 10));
      }
    }

    // ⭐ NEW: Nút tua tiến 10 giây  
    class Forward10Button extends Button {
      constructor(player, options) {
        super(player, options);
        this.addClass('vjs-forward-10');
        this.controlText('Tua tiến 10 giây');
      }
      handleClick() {
        const currentTime = this.player().currentTime();
        const duration = this.player().duration();
        this.player().currentTime(Math.min(duration, currentTime + 10));
      }
    }

    // ⭐ NEW: Settings button  
    class SettingsButton extends Button {
      constructor(player, options) {
        super(player, options);
        this.addClass('vjs-settings-button');
        this.controlText('Cài đặt');
      }

      createEl() {
        const el = super.createEl();
        // Add icon placeholder for React component
        el.innerHTML = '<span class="vjs-icon-placeholder"></span>';

        // Use ReactDOM to render FontAwesome component
        setTimeout(() => {
          const iconPlaceholder = el.querySelector('.vjs-icon-placeholder');
          if (iconPlaceholder) {
            iconPlaceholder.innerHTML = '';
            const root = ReactDOM.createRoot(iconPlaceholder);
            root.render(<FontAwesomeIcon icon={faGear} style={{ fontSize: '16px', color: 'white' }} />);
          }
        }, 0);

        return el;
      }

      handleClick(e) {
        // Ngăn sự kiện lan truyền để tránh trigger handleClickOutside
        if (e) {
          e.stopPropagation();
        }
        setShowSettingsMenu(prev => !prev);
      }
    }

    // đăng ký component 1 lần
    if (!videojs.getComponent('PrevEpButton')) videojs.registerComponent('PrevEpButton', PrevEpButton);
    if (!videojs.getComponent('NextEpButton')) videojs.registerComponent('NextEpButton', NextEpButton);
    if (!videojs.getComponent('Rewind10Button')) videojs.registerComponent('Rewind10Button', Rewind10Button);
    if (!videojs.getComponent('Forward10Button')) videojs.registerComponent('Forward10Button', Forward10Button);
    if (!videojs.getComponent('SettingsButton')) videojs.registerComponent('SettingsButton', SettingsButton);

    const cb = p.getChild('controlBar');

    // chèn ngay trước nút Fullscreen (nếu không tìm thấy thì chèn cuối)
    const fsIndex = cb.children().findIndex(c => c?.name?.() === 'FullscreenToggle');
    const insertIndex = fsIndex >= 0 ? fsIndex : cb.children().length;

    // Thêm các nút theo thứ tự: rewind10, forward10, prev episode, next episode, settings
    rewind10BtnRef.current = cb.addChild('Rewind10Button', {}, insertIndex);
    forward10BtnRef.current = cb.addChild('Forward10Button', {}, insertIndex + 1);
    prevBtnRef.current = cb.addChild('PrevEpButton', {}, insertIndex + 2);
    nextBtnRef.current = cb.addChild('NextEpButton', {}, insertIndex + 3);
    settingsBtnRef.current = cb.addChild('SettingsButton', {}, insertIndex + 4);

    return () => {
      // gỡ khi unmount
      rewind10BtnRef.current?.dispose?.(); rewind10BtnRef.current = null;
      prevBtnRef.current?.dispose?.(); prevBtnRef.current = null;
      nextBtnRef.current?.dispose?.(); nextBtnRef.current = null;
      forward10BtnRef.current?.dispose?.(); forward10BtnRef.current = null;
      settingsBtnRef.current?.dispose?.(); settingsBtnRef.current = null;
    };
  }, [playerRef.current]); // chạy sau khi player đã được tạo

  useEffect(() => {
    if (prevBtnRef.current) {
      prevBtnRef.current.toggleClass('vjs-hidden', !prevEp);
    }
    if (nextBtnRef.current) {
      nextBtnRef.current.toggleClass('vjs-hidden', !nextEp);
    }
  }, [prevEp, nextEp]);

  // control videojs
  useEffect(() => {
    const handleKeyDown = (e) => {
      const p = playerRef.current;
      if (!p) return;

      // Chỉ hoạt động khi không có modal nào mở và không đang focus vào input
      const isModalOpen = showRatingModal || showUpgradeModal || showSettingsMenu;
      const isInputFocused = document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA' ||
        document.activeElement?.contentEditable === 'true';

      if (isModalOpen || isInputFocused) return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          if (p.paused()) {
            p.play();
          } else {
            p.pause();
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          const currentTimeLeft = p.currentTime();
          p.currentTime(Math.max(0, currentTimeLeft - 10));
          break;
        case 'ArrowRight':
          e.preventDefault();
          const currentTimeRight = p.currentTime();
          const duration = p.duration();
          p.currentTime(Math.min(duration, currentTimeRight + 10));
          break;
        default:
          break;
      }
    };

    const handleClickOutside = (e) => {
      // Chỉ close menu khi click RA NGOÀI và menu đang mở
      if (!showSettingsMenu) return;

      // Kiểm tra xem click có nằm trong menu hay nút settings không
      const clickedInsideMenu = e.target.closest('.settings-menu') ||
        e.target.closest('.video-settings-container');
      const clickedSettingsButton = e.target.closest('.vjs-settings-button');

      // Chỉ close khi click ra ngoài (không phải menu và không phải nút)
      if (!clickedInsideMenu && !clickedSettingsButton) {
        setShowSettingsMenu(false);
        setCurrentSettingsView('main');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    // Dùng 'mousedown' thay vì 'click' để tránh conflict
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [playerRef.current, showRatingModal, showUpgradeModal, showSettingsMenu]);

  // ✅ FIX: Giữ controls hiển thị khi menu settings đang mở
  useEffect(() => {
    const p = playerRef.current;
    if (!p) return;

    if (showSettingsMenu) {
      // Khi menu mở: thêm class để giữ controls luôn hiển thị
      p.addClass('vjs-user-active');
      p.addClass('vjs-has-started');

      // Ngăn Video.js tự động ẩn controls
      const keepControlsVisible = () => {
        p.addClass('vjs-user-active');
      };

      // Chạy interval để đảm bảo controls không bị ẩn
      const intervalId = setInterval(keepControlsVisible, 100);

      return () => {
        clearInterval(intervalId);
        // Khi đóng menu: cho phép Video.js hoạt động bình thường
        p.removeClass('vjs-user-active');
      };
    }
  }, [showSettingsMenu]);

  if (dataLoading) return <div className="watch-loading">Đang tải...</div>;
  if (!currentEp) return <div className="watch-empty">Không tìm thấy tập phim.</div>;

  return (
    <div className={`watch layout ${isTheater ? "theater" : ""}`}>
      {/* Bread + back */}
      <div className="watch-bread">
        <button onClick={() => navigate(-1)} className="btn-circle" title="Quay lại">
          ‹
        </button>
        <h1 className="watch-title">
          <span className="sub">Xem phim {currentMov?.title}</span>
        </h1>
      </div>

      {/* VIP Gate Check */}
      {gate.status === 'checking' && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '400px',
          flexDirection: 'column',
          gap: '10px'
        }}>
          <div>Đang kiểm tra quyền truy cập...</div>
          <div>⏳</div>
        </div>
      )}

      {gate.status === 'not_allowed' && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '400px',
          flexDirection: 'column',
          gap: '20px',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          border: '1px solid #ddd',
          borderRadius: '12px',
          margin: '20px',
          padding: '40px',
          color: 'white',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '48px' }}>�</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '10px' }}>
            Nội dung VIP Premium
          </div>
          <div style={{ fontSize: '16px', lineHeight: '1.6', maxWidth: '500px' }}>
            {gate.message}
          </div>
          <div style={{ display: 'flex', gap: '15px', marginTop: '20px' }}>
            <button
              onClick={() => navigate('/buy-package')}
              style={{
                background: 'linear-gradient(45deg, #ff6b6b, #ee5a24)',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 'bold',
                boxShadow: '0 4px 15px rgba(255, 107, 107, 0.3)',
                transition: 'transform 0.2s'
              }}
              onMouseOver={(e) => e.target.style.transform = 'translateY(-2px)'}
              onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
            >
              🚀 Nâng cấp VIP ngay
            </button>
            {!userId && (
              <button
                onClick={() => navigate('/login')}
                style={{
                  background: 'transparent',
                  color: 'white',
                  border: '2px solid white',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => {
                  e.target.style.background = 'white';
                  e.target.style.color = '#667eea';
                }}
                onMouseOut={(e) => {
                  e.target.style.background = 'transparent';
                  e.target.style.color = 'white';
                }}
              >
                🔑 Đăng nhập
              </button>
            )}
          </div>
        </div>
      )}

      {/* PLAYER - show when allowed or trial */}
      {['allowed', 'trial'].includes(gate.status) && (
        <section className="player-wrap">
          <div
            ref={frameRef}
            className={`player-frame`}
          >
            {/* ==== PREROLL AD OVERLAY ==== */}
            {showPreroll && (
              <div className="preroll-overlay">
                <video
                  ref={adVideoRef}
                  className="preroll-video"
                  playsInline
                  autoPlay
                  muted
                  controls={false}
                  onPlay={markAdSeen}
                  onCanPlay={markAdSeen}
                  onEnded={handleAdEnded}
                  onError={handleAdError}
                >
                  <source src={PREROLL_CONFIG.src} type="video/mp4" />
                </video>

                <div className="preroll-topbar">
                  <span className="preroll-label">Quảng cáo</span>
                  <button
                    className={`preroll-skip ${canSkip ? 'enabled' : ''}`}
                    onClick={handleSkipAd}
                    disabled={!canSkip}
                    aria-disabled={!canSkip}
                  >
                    {canSkip ? 'Bỏ qua ' : `Bỏ qua sau ${skipLeft}s`}
                  </button>
                </div>

                <div className="preroll-bottom">
                  <span>Xem miễn phí cùng quảng cáo • <b>Đăng ký NO ADS</b> để xem không quảng cáo</span>
                </div>
              </div>
            )}

            <div data-vjs-player style={{ position: 'relative' }}>
              <video
                id="watch-player"
                ref={videoRef}
                className="video-js vjs-default-skin vjs-big-play-centered"
                playsInline
                controls
              />

              {/* ✅ Trial countdown overlay - hiển thị TRONG video player */}
              {isTrialMode && !trialExpired && (
                <div className="trial-overlay-video">
                  <div className="trial-countdown-box">
                    <div className="trial-package-name">
                      Xem thử {gate.requiredPackage || 'VIP'}
                    </div>
                    <div className="trial-timer">
                      <span className="timer-icon">⏱️</span>
                      <span className="timer-text">
                        {Math.max(0, Math.ceil(trialTimeLimit - currentTime))}s còn lại
                      </span>
                    </div>
                    <div className="trial-subtitle">
                      Nâng cấp để xem đầy đủ
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ✅ Settings menu - render via Portal into player element */}
            {showSettingsMenu && playerEl &&
              createPortal(<SettingsMenu />, playerEl)
            }

            {/* ✅ Trial expired overlay */}
            {isTrialMode && trialExpired && (
              <div className="trial-expired-overlay">
                <div className="trial-expired-content">
                  <div className="trial-expired-icon">⏰</div>
                  <h3>Hết thời gian xem thử</h3>
                  <p>Nâng cấp {getPackageDisplayName(currentMov?.minVipLevel) || 'VIP'} để tiếp tục xem phim</p>
                  <button
                    className="btn-upgrade-now"
                    onClick={() => setShowUpgradeModal(true)}
                  >
                    Nâng cấp {getPackageDisplayName(currentMov?.minVipLevel) || 'VIP'} ngay
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Khi sticky bật, hiển thị thông tin phim phía trên */}
          {sticky && (
            <div className="watch-info-top">
              <h2>{currentMov?.title}</h2>
              <div className="tags">
                {currentMov?.year && <span className="chip">{currentMov.year}</span>}
                {currentMov?.genres?.slice(0, 4).map((g) => (
                  <span key={g} className="chip ghost">
                    {g}
                  </span>
                ))}
              </div>
              {currentMov?.desc && <p className="desc">{currentMov.desc}</p>}
            </div>
          )}

          {/* giữ chỗ khi sticky để trang không “tụt” */}
          {sticky && <div className="player-placeholder" style={{ height: playerH }} aria-hidden />}

          {/* CONTROL BAR */}
          <div className="action-toolbar">
            {/* nhóm 1: các hành động nhanh */}
            <div className="at-group">
              <button className={`at-item ${isInWishlist ? "active" : ""}`} onClick={handleToggleWishlist}>
                <FontAwesomeIcon icon={faHeart} /> <span>Yêu thích</span>
              </button>
              <button className={`at-item ${inList ? "active" : ""}`} onClick={() => setInList(v => !v)}>
                <FontAwesomeIcon icon={faPlus} /> <span>Thêm vào</span>
              </button>
              <button className="at-item">
                <FontAwesomeIcon icon={faShareNodes} /> <span>Chia sẻ</span>
              </button>
              <button
                className="at-item"
                onClick={() => setShowCreateRoomModal(true)}
                title={MyUser?.my_user?.packageType !== 'COMBO_PREMIUM_MEGA_PLUS' 
                  ? 'Tính năng dành cho gói COMBO PREMIUM' 
                  : 'Tạo phòng xem chung với bạn bè'}
                style={{
                  position: 'relative',
                  opacity: MyUser?.my_user?.packageType !== 'COMBO_PREMIUM_MEGA_PLUS' ? 0.7 : 1
                }}
              >
                <i className="fa-brands fa-forumbee"></i> 
                <span>Xem chung</span>
                {MyUser?.my_user?.packageType !== 'COMBO_PREMIUM_MEGA_PLUS' && (
                  <span style={{
                    position: 'absolute',
                    top: '-5px',
                    right: '-5px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    fontSize: '10px',
                    padding: '2px 5px',
                    borderRadius: '4px',
                    fontWeight: 'bold'
                  }}>
                    👑
                  </span>
                )}
              </button>
              {MyUser && (
                <button className="at-item danger" onClick={() => setShowReportModal(true)}>
                  <FontAwesomeIcon icon={faFlag} /> <span>Báo lỗi</span>
                </button>
              )}
            </div>

            {/* nhóm 2: các toggle */}
            <div className="at-group">
              <div className="at-toggle">
                <span>Tự chuyển</span>
                <label className="switch">
                  <input type="checkbox" checked={autoNext} onChange={e => setAutoNext(e.target.checked)} />
                  <span className="slider" />
                </label>
              </div>
              <div className="at-toggle">
                <span>Rạp phim</span>
                <label className="switch">
                  <input type="checkbox" checked={isTheater} onChange={e => setIsTheater(e.target.checked)} />
                  <span className="slider" />
                </label>
              </div>
            </div>

            {/* Rating – là nơi DUY NHẤT hiển thị điểm */}
            <button className="at-rate" onClick={() => setShowRatingModal(true)} title="Đánh giá bộ phim">
              <span className="star">★</span>
              <span className="score">{avgRating.toFixed(1)}</span>
              <span className="count">({totalRatings})</span>
              <span className="label">Đánh giá</span>
            </button>


          </div>
        </section>
      )}

      {/* MAIN CONTENT */}
      <div className="watch-grid">
        {/* LEFT */}
        <div className="wg-main">
          <div className="info-card">
            <div className="poster">
              <img src={currentMov?.poster || currentMov?.thumbnailUrl} alt={currentMov?.title} />
              <div className="quality-badge">HD</div>
            </div>
            <div className="meta">
              <h2 className="movie-title">
                <Link to={`/movie/${currentMov?.movieId || currentMov?.id}`}>{currentMov?.title}</Link>
              </h2>

              <div className="tags">
                {currentMov?.releaseYear && <span className="chip year">{currentMov.releaseYear}</span>}
                {currentMov?.genres?.slice(0, 4).map((g) => (
                  <span key={g} className="chip genre">
                    {g}
                  </span>
                ))}
              </div>

              {currentMov?.description && (
                <div className="description-section">
                  <p className={`description ${showFullDescription ? "expanded" : "collapsed"}`}>
                    {currentMov.description}
                  </p>
                  {currentMov.description.length > 150 && (
                    <button
                      className="toggle-description"
                      onClick={() => setShowFullDescription(!showFullDescription)}
                    >
                      {showFullDescription ? "Thu gọn" : "Xem thêm"}
                      <span className={`arrow ${showFullDescription ? "up" : "down"}`}>
                        {showFullDescription ? "▲" : "▼"}
                      </span>
                    </button>
                  )}
                </div>
              )}

              <div className="movie-stats">
                <div className="stat-item">
                  <FontAwesomeIcon icon={faEye} className="stat-icon" />
                  <span className="stat-value">{currentMov?.viewCount || 0}</span>
                  <span className="stat-label">lượt xem</span>
                </div>
              </div>
            </div>
          </div>

          <div className="episodes-box">
            <div className="eb-head">
              <div className="season-bar">
                {seasons.map((s) => (
                  <button
                    key={s.seasonId}
                    className={`btn-season ${selectedSeason?.seasonId === s.seasonId ? "is-active" : ""}`}
                    onClick={() => handlePickSeason(s)}
                  >
                    Season {s.seasonNumber}
                    {Number(s.episodesCount) ? <span className="mini-badge">{s.episodesCount}</span> : null}
                  </button>
                ))}
                {seasons.length === 0 && <span className="text-muted">Chưa có season.</span>}
              </div>

              <div className="right-tools">
                <Funnel size={18} />
                <span>Lọc</span>
              </div>
            </div>

            <div className="eb-grid">
              {epsOfSeason.length > 0 ? (
                epsOfSeason.map((ep) => {
                  const epId = ep.episodeId;
                  const epNo = ep.episodeNumber;
                  const cur = currentEpisode || episodeFromState;
                  return (
                    <button
                      key={epId}
                      className={`ep-card ${epId === cur?.episodeId ? "active" : ""}`}
                      onClick={() => {
                        const cm = currentMov;
                        const watchUrl = createWatchUrl(cm, ep);
                        navigate(watchUrl, {
                          state: { episode: ep, movie: cm, episodes: epsOfSeason, authors, seasons },
                        });
                      }}
                    >
                      <div className="ep-meta">
                        <span className="ep-no">Tập {epNo}</span>
                        <span className="ep-title">{ep.title || ""}</span>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="text-muted" style={{ padding: "10px" }}>
                  Season này chưa có tập.
                </div>
              )}
            </div>
          </div>

          {/* BÌNH LUẬN */}
          <div className="container mt-4">
            <h5 className="text-white">
              <i className="fa-regular fa-comment-dots me-2" /> Bình luận
            </h5>
            {!userId && (
              <small className="text-white mb-3">
                Vui lòng{" "}
                <a href="/" style={{ color: "#4bc1fa", textDecoration: "none" }} className="fw-bold">
                  đăng nhập
                </a>{" "}
                để tham gia bình luận.
              </small>
            )}

            <div className="card bg-black border-0 mb-3 mt-3">
              <div className="card-body">
                <textarea
                  className="form-control bg-dark text-white border-secondary"
                  rows="3"
                  placeholder="Viết bình luận..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  maxLength={1000}
                  style={{
                    height: "100px",
                    resize: "none",
                    color: "#ffffff !important",
                    backgroundColor: "#343a40 !important",
                  }}
                  disabled={submitting || !userId}
                />
                <div className="d-flex justify-content-between align-items-center mt-2 bg-black">
                  <small className="text-white">{comment.length} / 1000</small>
                  <i
                    role="button"
                    aria-disabled={submitting || !comment.trim() || !userId}
                    className={`btn-rate ms-1 ${submitting || !comment.trim() || !userId ? "opacity-50 pe-none" : ""}`}
                    onClick={handleFeedbackSubmit}
                  >
                    {submitting ? "Đang gửi..." : "Gửi"} <i className="fa-solid fa-paper-plane ms-1" />
                  </i>
                </div>
              </div>
            </div>

            <div className="container mt-4 comments-top">
              {comments.map((fb) => (
                <FeedbackItem
                  key={fb.feedbackId}
                  fb={fb}
                  userId={userId}
                  replyTo={replyTo}
                  replyContent={replyContent}
                  setReplyContent={setReplyContent}
                  setReplyTo={setReplyTo}
                  handleLikeFeedback={handleLikeFeedback}
                  handleDislikeFeedback={handleDislikeFeedback}
                  handleSendReply={handleSendReply}
                />
              ))}

              {comments.length === 0 && (
                <div className="text-secondary text-center py-3">Chưa có bình luận nào</div>
              )}
            </div>

            <nav aria-label="Feedback pagination" className="mt-2">
              <ul className="pagination justify-content-center">
                <li className={`page-item ${page === 0 ? "disabled" : ""}`}>
                  <button className="page-link" onClick={() => goTo(page - 1)} aria-label="Previous">
                    &laquo;
                  </button>
                </li>
                {pageItems.map((it, idx) =>
                  typeof it === "number" ? (
                    <li key={idx} className={`page-item ${page === it ? "active" : ""}`}>
                      <button className="page-link" onClick={() => goTo(it)}>
                        {it + 1}
                      </button>
                    </li>
                  ) : (
                    <li key={idx} className="page-item disabled">
                      <span className="page-link">…</span>
                    </li>
                  )
                )}
                <li className={`page-item ${page >= totalPages - 1 ? "disabled" : ""}`}>
                  <button className="page-link" onClick={() => goTo(page + 1)} aria-label="Next">
                    &raquo;
                  </button>
                </li>
              </ul>
            </nav>
          </div>
        </div>

        {/* RIGHT */}
        <aside className="wg-side">
          <div className="cast-crew-box">
            <div className="box-head">Thông tin tham gia</div>

            {/* Đạo diễn */}
            {authors.filter((a) => a.authorRole === "DIRECTOR").length > 0 && (
              <div className="crew-section">
                <h6 className="crew-title">Đạo diễn:</h6>
                <div className="crew-list">
                  {authors
                    .filter((a) => a.authorRole === "DIRECTOR")
                    .map((a, index, arr) => (
                      <span key={a.authorId}>
                        <Link
                          className="crew-name"
                          to={`/browse/author-id/${encodeURIComponent(a.authorId)}`}
                        >
                          {a.name}
                        </Link>
                        {index < arr.length - 1 && ", "}
                      </span>
                    ))}
                </div>
              </div>
            )}

            {/* Diễn viên */}
            {authors.filter((a) => a.authorRole === "PERFORMER").length > 0 && (
              <div className="crew-section">
                <h6 className="crew-title">Diễn viên:</h6>
                <div className="crew-list">
                  {authors
                    .filter((a) => a.authorRole === "PERFORMER")
                    .map((a, index, arr) => (
                      <span key={a.authorId}>
                        <Link
                          className="crew-name"
                          to={`/browse/author-id/${encodeURIComponent(a.authorId)}`}
                        >
                          {a.name}
                        </Link>
                        {index < arr.length - 1 && ", "}
                      </span>
                    ))}
                </div>
              </div>
            )}

            {/* Trường hợp không có dữ liệu */}
            {authors.length === 0 && (
              <div className="text-muted" style={{ padding: "12px" }}>
                Chưa có thông tin về đạo diễn và diễn viên
              </div>
            )}
          </div>

          <div className="suggest-box">
            <div className="box-head">Đề xuất cho bạn</div>
            <div className="suggest">
              {suggestedMovies.length > 0 ? (
                suggestedMovies.map((movie) => (
                  <Link key={movie.movieId || movie.id} className="s-item" to={`/movie/${movie.movieId || movie.id}`}>
                    <img src={movie.poster || movie.thumbnailUrl} alt={movie.title} />
                    <div className="s-meta">
                      <div className="t">{movie.title}</div>
                      <div className="a">{movie.alias || movie.originalTitle || ""}</div>
                      <div className="line">
                        {movie.releaseYear && <span className="chip">{movie.releaseYear}</span>}
                        {movie.genres?.slice(0, 2).map(genre => (
                          <span key={genre} className="chip ghost">{genre}</span>
                        ))}
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="text-muted" style={{ padding: "12px" }}>
                  Đang tải phim đề xuất...
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* ✅ VIP Upgrade Modal - Component riêng */}
      <UpgradeModal
        show={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        currentMovie={currentMov}
        userId={userId}
        getPackageDisplayName={getPackageDisplayName}
      />

      {/* Resume modal - shows when we found saved progress for this episode */}
      {showResumeModal && (
        <div className="resume-modal-backdrop">
          <div className="resume-modal">
            <h3 className="resume-title">THÔNG BÁO!</h3>
            <p className="resume-text">Bạn đã xem đến <span className="resume-badge">{formatTimeHuman(resumeTime)}</span></p>
            <div className="resume-actions">
              <button onClick={handleResumeContinue} className="resume-btn resume-continue">Tiếp tục xem</button>
              <button onClick={handleResumeRestart} className="resume-btn resume-restart">Xem lại từ đầu</button>
              <button onClick={handleDismissResume} className="resume-btn resume-dismiss">Đóng</button>
            </div>
          </div>
        </div>
      )}

      <RatingModal
        show={showRatingModal}
        movieTitle={currentMov?.title}
        average={avgRating}
        total={totalRatings}
        onClose={() => setShowRatingModal(false)}
        onSubmit={handleRateSubmit}
      />

      <ReportIssueModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        movieId={currentMov?.movieId}
        movieTitle={currentMov?.title}
        episodeId={currentEpisode?.episodeId}
        episodeTitle={currentEpisode?.title}
        currentTime={currentTime}
      />

      <CreateWatchRoomModal
        show={showCreateRoomModal}
        onClose={() => setShowCreateRoomModal(false)}
        movie={currentMov}
        episode={currentEpisode}
        currentVideoUrl={optimizedUrl}
      />
    </div>
  );
}
