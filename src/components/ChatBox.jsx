// ChatBox.jsx
import React, { useState, useEffect, useRef } from "react";
import { sendMessageToServer, fetchWelcome } from "../services/ChatService";
import { Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import "../css/ChatBox.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUpRightAndDownLeftFromCenter, faCommentDots } from "@fortawesome/free-solid-svg-icons";
import { useAuth } from "../context/AuthContext";

const ChatBox = ({ currentMovieId }) => {
  const { MyUser } = useAuth();
  
  // ✅ Function to format package names to user-friendly text
  const formatPackageNames = (note) => {
    if (!note) return note;
    
    const packageMap = {
      'ads_30': 'ads 1 tháng',
      'ads_60': 'ads 2 tháng', 
      'ads_90': 'ads 3 tháng',
      'ads_120': 'ads 4 tháng',
      'ads_180': 'ads 6 tháng',
      'ads_360': 'ads 12 tháng',
      'combo_30': 'combo 1 tháng',
      'combo_60': 'combo 2 tháng',
      'combo_90': 'combo 3 tháng',
      'combo_120': 'combo 4 tháng',
      'combo_180': 'combo 6 tháng',
      'combo_360': 'combo 12 tháng',
      'premium_30': 'premium 1 tháng',
      'premium_60': 'premium 2 tháng',
      'premium_90': 'premium 3 tháng',
      'premium_120': 'premium 4 tháng',
      'premium_180': 'premium 6 tháng',
      'premium_360': 'premium 12 tháng',
      'mega_30': 'mega 1 tháng',
      'mega_60': 'mega 2 tháng',
      'mega_90': 'mega 3 tháng',
      'mega_120': 'mega 4 tháng',
      'mega_180': 'mega 6 tháng',
      'mega_360': 'mega 12 tháng',
      'no_ads': 'không quảng cáo',
      'vip': 'VIP'
    };

    let formattedNote = note;
    
    // Replace package codes with readable names
    Object.entries(packageMap).forEach(([code, readable]) => {
      const regex = new RegExp(code, 'gi');
      formattedNote = formattedNote.replace(regex, readable);
    });
    
    return formattedNote;
  };
  
  // ✅ Conversation ID for persistent chat session
  const convRef = useRef(localStorage.getItem('ai_conv_id') || crypto.randomUUID());
  useEffect(() => {
    localStorage.setItem('ai_conv_id', convRef.current);
  }, []);

  const [message, setMessage] = useState("");
  const [chatLog, setChatLog] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [questionCount, setQuestionCount] = useState(0);
  const [showQuickSuggestions, setShowQuickSuggestions] = useState(false); // ✅ NEW: state để control quick suggestions
  const MAX_QUESTIONS_GUEST = 3; // Giới hạn 3 câu hỏi cho khách
  
  // Ref để scroll xuống tin nhắn cuối cùng
  const chatContentRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Reset conversation function
  const resetConversation = () => {
    localStorage.removeItem('ai_conv_id');
    convRef.current = crypto.randomUUID();
    localStorage.setItem('ai_conv_id', convRef.current);
    setChatLog([]);
    setQuestionCount(0);
  };
  
  const [quick, setQuick] = useState([
    "Có khuyến mãi nào đang hoạt động không?",
    "Voucher giảm giá gói VIP hiện tại",
    "Ưu đãi đặc biệt hôm nay",
    "Mã giảm giá cho thành viên mới",
    "Gợi ý phim hoạt hình hay nhất",
  ]);

  // Hàm scroll xuống cuối
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ 
        behavior: "smooth", 
        block: "end" 
      });
    }
  };

  // Auto scroll khi có tin nhắn mới hoặc loading thay đổi
  useEffect(() => {
    scrollToBottom();
  }, [chatLog, loading]);

  // Khi mở chat lần đầu -> gọi welcome
  useEffect(() => {
    if (isOpen && chatLog.length === 0) {
      (async () => {
        try {
          const res = await fetchWelcome(convRef.current);
          const welcomeMsg = MyUser 
            ? res.answer.replace(/bạn/gi, MyUser?.my_user?.userName || MyUser?.username || "bạn")
            : res.answer;
          
          // Normalize promos data - BE uses 'title', FE expects 'promotionName'
          const normalizedPromos = res.showPromos && Array.isArray(res.promos)
            ? res.promos
                .filter(p => p && p.promotionId) // Only need valid ID
                .map(p => ({
                    ...p,
                    // BE uses 'title'; FE uses 'promotionName' → sync for compatibility
                    promotionName: p.promotionName || p.title,
                }))
            : [];
            
          setChatLog([{ 
            role: "assistant", 
            content: welcomeMsg, 
            suggestions: res.showSuggestions ? res.suggestions : [], 
            showSuggestions: res.showSuggestions,
            promos: normalizedPromos,
            showPromos: normalizedPromos.length > 0
          }]);
        } catch(e) {
          console.error("❌ Welcome API failed:", e);
          const errorMsg = e.message || "Không thể kết nối tới server chat";
          const welcomeText = MyUser 
            ? `Chào ${MyUser?.my_user?.userName || MyUser?.username}! ${errorMsg}`
            : `Chào bạn! ${errorMsg} (Giới hạn 3 câu hỏi cho khách)`;
          setChatLog([{ role: "assistant", content: welcomeText }]);
        }
      })();
    }
  }, [isOpen, MyUser]);

  // Reset questionCount khi user đăng nhập/đăng xuất
  useEffect(() => {
    if (MyUser) {
      setQuestionCount(0); // Reset khi đăng nhập
    }
  }, [MyUser]);

  const handleSend = async () => {
    if (!message.trim()) return;
    
    // Kiểm tra giới hạn câu hỏi cho khách
    if (!MyUser && questionCount >= MAX_QUESTIONS_GUEST) {
      setChatLog((prev) => [...prev, { 
        role: "assistant", 
        content: "❌ Bạn đã hết lượt hỏi! Vui lòng đăng nhập để tiếp tục sử dụng dịch vụ." 
      }]);
      return;
    }

    const userMsg = { 
      role: "user", 
      content: message,
      username: MyUser ? (MyUser?.my_user?.userName || MyUser?.username) : "Khách"
    };
    setChatLog((prev) => [...prev, userMsg]);
    setMessage("");
    setLoading(true);

    // Tăng số câu hỏi nếu là khách
    if (!MyUser) {
      setQuestionCount(prev => prev + 1);
    }

    try {
      const res = await sendMessageToServer(message, currentMovieId, convRef.current);
      
      // Normalize promos data - BE uses 'title', FE expects 'promotionName'
      const normalizedPromos = res.showPromos && Array.isArray(res.promos)
        ? res.promos
            .filter(p => p && p.promotionId) // Only need valid ID
            .map(p => ({
                ...p,
                // BE uses 'title'; FE uses 'promotionName' → sync for compatibility
                promotionName: p.promotionName || p.title,
            }))
        : [];
      
      const aiMsg = {
        role: "assistant",
        content: res.answer,
        suggestions: Array.isArray(res.suggestions) ? res.suggestions : [],
        showSuggestions: (res.showSuggestions ?? (res.suggestions?.length > 0)),
        promos: normalizedPromos,
        showPromos: normalizedPromos.length > 0
      };
      setChatLog((prev) => [...prev, aiMsg]);
    } catch (error) {
      console.error("❌ Chat error:", error);
      const errorMsg = error.message || "Lỗi không xác định";
      setChatLog((prev) => [...prev, { 
        role: "assistant", 
        content: `❌ ${errorMsg}` 
      }]);
    } finally { setLoading(false); }
  };

  // Khi click quick-chip -> gửi luôn
  const sendQuick = async (text) => {
    // Kiểm tra giới hạn câu hỏi cho khách
    if (!MyUser && questionCount >= MAX_QUESTIONS_GUEST) {
      setChatLog((prev) => [...prev, { 
        role: "assistant", 
        content: "❌ Bạn đã hết lượt hỏi! Vui lòng đăng nhập để tiếp tục sử dụng dịch vụ." 
      }]);
      return;
    }

    const userMsg = { 
      role: "user", 
      content: text,
      username: MyUser ? (MyUser?.my_user?.userName || MyUser?.username) : "Khách"
    };
    setChatLog((prev) => [...prev, userMsg]);
    setLoading(true);

    // Tăng số câu hỏi nếu là khách
    if (!MyUser) {
      setQuestionCount(prev => prev + 1);
    }

    try {
      const res = await sendMessageToServer(text, currentMovieId, convRef.current);
      
      // Normalize promos data - BE uses 'title', FE expects 'promotionName'
      const normalizedPromos = res.showPromos && Array.isArray(res.promos)
        ? res.promos
            .filter(p => p && p.promotionId) // Only need valid ID
            .map(p => ({
                ...p,
                // BE uses 'title'; FE uses 'promotionName' → sync for compatibility
                promotionName: p.promotionName || p.title,
            }))
        : [];
        
      const aiMsg = {
        role: "assistant",
        content: res.answer,
        suggestions: res.showSuggestions ? (res.suggestions || []) : [],
        showSuggestions: !!res.showSuggestions,
        promos: normalizedPromos,
        showPromos: normalizedPromos.length > 0
      };
      setChatLog((prev) => [...prev, aiMsg]);
    } catch {
      setChatLog((prev) => [...prev, { role: "assistant", content: "❌ Lỗi khi gọi AI!" }]);
    } finally { 
      setLoading(false); 
    }
  };

  if (!isOpen) {
    return (
      <div
        onClick={() => setIsOpen(true)}
        style={{
          position: "fixed", bottom: 20, right: 20, width: 60, height: 60,
          borderRadius: "50%", backgroundColor: "#007bff", color: "white",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 28, cursor: "pointer", zIndex: 9999,
        }}
      >
        <FontAwesomeIcon icon={faCommentDots} />
      </div>
    );
  }

  return (
    <div className={`chatbox-wrapper${isFullScreen ? " fullscreen" : ""}`}>
      <div className="chatbox-container">
        <div className="chatbox-header">
          <span>Chat AI CartoonToo</span>
          <div className="header-actions">
            <button 
              className="chatbox-suggestion-btn" 
              onClick={() => setShowQuickSuggestions(!showQuickSuggestions)}
              title={showQuickSuggestions ? "Ẩn gợi ý nhanh" : "Hiện gợi ý nhanh"}
            >
              💡
            </button>
            {!isFullScreen ? (
              <button className="chatbox-zoom-btn" onClick={() => setIsOpen(false)} title="Thu gọn">
                <FontAwesomeIcon icon={faUpRightAndDownLeftFromCenter} />
              </button>
            ) : (
              <button className="chatbox-zoom-btn" onClick={() => setIsFullScreen(false)} title="Thu nhỏ">🗗</button>
            )}
          </div>
        </div>

        <div className="chatbox-content" ref={chatContentRef}>
          {chatLog.map((msg, i) => (
            <div className={`chatbox-message ${msg.role}`} key={i}>
              <strong>{msg.role === "user" ? `${msg.username}: ` : "AI: "}</strong>
              <ReactMarkdown>{msg.content}</ReactMarkdown>

              {msg.suggestions?.length > 0 && (
                <div className="suggestion-grid">
                  {msg.suggestions.map((m, idx) => (
                     <Link
                        key={m.movieId}
                        to={`/movie/${m.movieId}`}
                        className="movie-suggestion-card"
                        onClick={() => setIsOpen(false)}
                      >
                      <img src={m.thumbnailUrl} alt={m.title} className="movie-thumb" />
                      <div className="movie-info">
                        <div className="movie-title">{idx + 1}. {m.title}</div>
                        <div className="movie-meta">
                          <span>{m.viewCount} lượt xem</span>
                          <div><strong>Thể loại:</strong> {m.genres?.join(", ")}</div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {/* PROMOS - Updated for new Backend Promotion model */}
              {msg.showPromos && msg.promos?.length > 0 && (
                <div className="promo-grid">
                  {msg.promos.map((promo, i) => (
                    <div key={`${promo.promotionId}-${i}`} className="promo-card">
                      <div className="promo-title">🎉 {promo.title || promo.promotionName}</div>
                      <div className="promo-meta">
                        <div><b>Loại:</b> <span className="promo-type">{promo.type === 'PACKAGE' ? 'GÓI' : promo.type === 'VOUCHER' ? 'PHIẾU GIẢM GIÁ' : promo.type}</span></div>
                        
                        {/* Hiển thị voucher code nếu có */}
                        {promo.voucherCode && (
                          <div className="voucher-code-row">
                            <b>Mã giảm giá:</b> 
                            <span 
                              className="voucher-code" 
                              onClick={() => {
                                navigator.clipboard.writeText(promo.voucherCode);
                                alert(`✅ Đã sao chép mã: ${promo.voucherCode}`);
                              }}
                              title="Click để copy mã voucher"
                            >
                              {promo.voucherCode}
                            </span>
                          </div>
                        )}
                        
                        {/* Hiển thị phần trăm giảm giá */}
                        {promo.discountPercent != null && (
                          <div><b>Giảm giá:</b> <span className="discount-percent">{promo.discountPercent}%</span></div>
                        )}
                        
                        {/* Hiển thị giới hạn giảm tối đa */}
                        {promo.maxDiscountAmount != null && promo.maxDiscountAmount > 0 && (
                          <div><b>Giảm tối đa:</b> <span className="max-discount">{promo.maxDiscountAmount.toLocaleString('vi-VN')}đ</span></div>
                        )}
                        
                        {/* Hiển thị thời gian hiệu lực */}
                        {promo.endDate && (
                          <div><b>Hết hạn:</b> <span className="expiry-date">{new Date(promo.endDate).toLocaleDateString('vi-VN')}</span></div>
                        )}
                        
                        {/* Hiển thị trạng thái */}
                        <div><b>Trạng thái:</b> <span className={`status ${promo.status?.toLowerCase()}`}>{promo.status === 'ACTIVE' ? 'HOẠT ĐỘNG' : promo.status === 'INACTIVE' ? 'NGƯNG HOẠT ĐỘNG' : promo.status}</span></div>
                      </div>
                      
                      {/* Ghi chú chi tiết */}
                      {promo.note && <div className="promo-note">💡 {formatPackageNames(promo.note)}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {loading && <div className="chatbox-message assistant">AI đang trả lời...</div>}
          
          {/* Hiển thị quick suggestions khi chat trống hoặc chỉ có welcome message HOẶC khi user bật manually */}
          {(showQuickSuggestions || chatLog.length === 0 || (chatLog.length === 1 && chatLog[0].role === "assistant")) && (
            <div className="quick-suggestions">
              <div className="quick-title">💡 Bạn có thể hỏi:</div>
              <div className="quick-chips">
                {quick.map((q, idx) => (
                  <button 
                    key={idx} 
                    className="quick-chip"
                    onClick={() => {
                      sendQuick(q);
                      setShowQuickSuggestions(false); // Ẩn đi sau khi click
                    }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {/* Invisible element để scroll xuống */}
          <div ref={messagesEndRef} />
        </div>

        <div className="chatbox-input-area">
          <div className="input-wrapper">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder={MyUser ? "Nhập câu hỏi về phim..." : `Câu hỏi về phim... (${MAX_QUESTIONS_GUEST - questionCount}/3)`}
              className="chatbox-input"
              disabled={!MyUser && questionCount >= MAX_QUESTIONS_GUEST}
            />
            {!MyUser && questionCount < MAX_QUESTIONS_GUEST && (
              <span className="guest-limit-badge">{MAX_QUESTIONS_GUEST - questionCount}</span>
            )}
          </div>
          <button 
            onClick={handleSend} 
            className="chatbox-send-button"
            disabled={!MyUser && questionCount >= MAX_QUESTIONS_GUEST}
          >
            Gửi
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatBox;
