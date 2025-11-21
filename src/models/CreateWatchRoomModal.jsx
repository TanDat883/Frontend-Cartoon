/**
 * CreateWatchRoomModal - Modal to create watch together room
 */
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import WatchRoomService from '../services/WatchRoomService';
import axiosInstance from '../api/axiosInstance';
import { toast } from 'react-toastify';
import '../css/CreateWatchRoomModal.css';

const CreateWatchRoomModal = ({ show, onClose, movie, episode, currentVideoUrl }) => {
  const navigate = useNavigate();
  const { MyUser } = useAuth();
  const [roomName, setRoomName] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [vipStatus, setVipStatus] = useState(null);
  const [isCheckingVip, setIsCheckingVip] = useState(true);
  const [canCreateRoom, setCanCreateRoom] = useState(false);
  const [vipMessage, setVipMessage] = useState('');

  // ✅ Check VIP status when modal opens
  React.useEffect(() => {
    if (show && MyUser?.my_user?.userId) {
      checkVipStatus();
    }
  }, [show, MyUser]);

  const checkVipStatus = async () => {
    const userId = MyUser.my_user.userId;
    setIsCheckingVip(true);

    try {
      // ✅ Use axiosInstance instead of fetch for better error handling
      const response = await axiosInstance.get(`/users/${userId}/vip-status`);
      
      const data = response.data;
      setVipStatus(data);
      
      // Check all 3 conditions
      const hasCombo = data.packageType === 'COMBO_PREMIUM_MEGA_PLUS';
      const isActive = data.status === 'ACTIVE';
      
      let notExpired = true;
      if (data.endDate && data.endDate !== '') {
        const endDate = new Date(data.endDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        notExpired = endDate >= today;
      }
      
      // Set can create room and message
      if (hasCombo && isActive && notExpired) {
        setCanCreateRoom(true);
        setVipMessage(`✅ Gói COMBO PREMIUM của bạn còn hiệu lực đến ${new Date(data.endDate).toLocaleDateString('vi-VN')}`);
      } else {
        setCanCreateRoom(false);
        
        if (data.status === 'NONE') {
          setVipMessage('🔒 Chức năng này chỉ dành cho người dùng có gói COMBO PREMIUM');
        } else if (!notExpired) {
          setVipMessage(`🔒 Gói COMBO PREMIUM đã hết hạn vào ${new Date(data.endDate).toLocaleDateString('vi-VN')}`);
        } else if (!isActive) {
          setVipMessage(`🔒 Gói ${data.packageType} không còn hoạt động`);
        } else if (!hasCombo) {
          setVipMessage('🔒 Chỉ gói COMBO PREMIUM mới có thể tạo phòng xem chung');
        }
      }
      
      console.log('📊 VIP Check Result:', { hasCombo, isActive, notExpired, canCreate: hasCombo && isActive && notExpired });
      
    } catch (error) {
      console.error('Error checking VIP status:', error);
      setCanCreateRoom(false);
      setVipMessage('⚠️ Lỗi khi kiểm tra gói dịch vụ. Vui lòng thử lại!');
    } finally {
      setIsCheckingVip(false);
    }
  };

  if (!show) return null;

  const handleCreate = async () => {
    // Double check - should not happen if button is disabled
    if (!canCreateRoom) {
      toast.error(vipMessage);
      return;
    }

    // Ưu tiên dùng currentVideoUrl (URL đang phát), fallback về episode.videoUrl
    const videoUrl = currentVideoUrl || episode?.videoUrl;
    
    if (!videoUrl) {
      toast.error('⚠️ Không tìm thấy video URL. Vui lòng đợi video load xong!');
      return;
    }

    if (!MyUser?.my_user) {
      toast.error('⚠️ Vui lòng đăng nhập để tạo phòng!');
      return;
    }

    setIsCreating(true);

    try {
      console.log('✅ Creating watch room with verified VIP status');

      // Generate room ID
      const roomId = 'room_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
      
      // Prepare room data
      const roomData = {
        roomId: roomId,
        userId: MyUser.my_user.userId,
        movieId: movie?.movieId || movie?.id,
        roomName: roomName.trim() || `Cùng xem ${movie?.title || 'phim này'}`,
        posterUrl: movie?.poster || movie?.thumbnailUrl,
        videoUrl: videoUrl, // Save video URL to database
        isPrivate: isPrivate,
        isAutoStart: false,
        startAt: null,
        createdAt: new Date().toISOString(),
        status: 'ACTIVE'
      };

      console.log('Calling API to create room:', roomData);

      // Call API to create room in database
      await WatchRoomService.createWatchRoom(roomData);

      toast.success('Tạo phòng thành công! Đang chuyển đến phòng...');

      // Close modal
      onClose();

      // Navigate to watch together page with video URL
      const params = new URLSearchParams({
        video: videoUrl,
        host: '1', // Creator is host
      });

      console.log('Navigating to:', `/watch-together/${roomId}?${params.toString()}`);
      
      // Small delay for toast to show
      setTimeout(() => {
        navigate(`/watch-together/${roomId}?${params.toString()}`);
      }, 500);

    } catch (error) {
      console.error('Error creating watch room:', error);
      toast.error('❌ Không thể tạo phòng. Vui lòng thử lại!');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="create-watch-room-modal-overlay" onClick={onClose}>
      <div className="create-watch-room-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>🎬 Tạo phòng xem chung</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="movie-info">
            <img 
              src={movie?.poster || movie?.thumbnailUrl} 
              alt={movie?.title}
              className="movie-poster"
            />
            <div className="movie-details">
              <h4>{movie?.title}</h4>
              <p>Tập {episode?.episodeNumber}: {episode?.episodeTitle || `Tập ${episode?.episodeNumber}`}</p>
            </div>
          </div>

          <div className="form-group">
            <label>Tên phòng (tùy chọn)</label>
            <input
              type="text"
              className="form-input"
              placeholder={`Cùng xem ${movie?.title || 'phim này'} nào!`}
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              maxLength={100}
            />
          </div>

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
              />
              <span>🔒 Phòng riêng tư (cần link mời)</span>
            </label>
          </div>

          <div className="info-box">
            <p>ℹ️ Bạn sẽ là <strong>Host</strong> và có thể điều khiển video</p>
            <p>Chia sẻ link để bạn bè cùng xem!</p>
          </div>

          {/* ✅ VIP Status Message */}
          {isCheckingVip ? (
            <div className="vip-status-box checking">
              <span className="spinner-small"></span>
              <span>Đang kiểm tra gói dịch vụ...</span>
            </div>
          ) : (
            <div className={`vip-status-box ${canCreateRoom ? 'success' : 'warning'}`}>
              <p>{vipMessage}</p>
              {!canCreateRoom && (
                <Link to="/buy-package" className="upgrade-link">
                  Nâng cấp gói COMBO PREMIUM →
                </Link>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button 
            className="btn-create" 
            onClick={handleCreate}
            disabled={isCreating || isCheckingVip || !canCreateRoom}
          >
            {isCreating ? (
              <>
                <span className="spinner"></span>
                <span>Đang tạo...</span>
              </>
            ) : isCheckingVip ? (
              'Đang kiểm tra...'
            ) : !canCreateRoom ? (
              '🔒 Tạo phòng (Cần gói COMBO)'
            ) : (
              '✅ Tạo phòng ngay'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateWatchRoomModal;
