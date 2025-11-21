/**
 * useWatchRoom - Main hook for Watch Together functionality
 * @author Senior FE Developer
 * @version 1.0
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getStompClient } from '../ws/stompClient';
import { watchRoomApi } from '../api/watchRoomApi';
import { WS_TYPES, WATCH_CONFIG, MESSAGE_TYPES } from '../types/watch';
import dayjs from 'dayjs';

// Debug logging (set to false to disable verbose logs)
const DEBUG_ENABLED = false; // ✅ Already disabled for production

/**
 * @typedef {import('../types/watch').WatchState} WatchState
 * @typedef {import('../types/watch').WsEvent} WsEvent
 */

/**
 * Hook for watch room connection and state management
 * @param {Object} options
 * @param {string} options.roomId
 * @param {string} options.userId
 * @param {string} options.userName
 * @param {string} [options.avatarUrl]
 * @param {string} [options.inviteCode]
 * @param {boolean} [options.forceHost] - Force user to be host (from URL param)
 * @param {Function} [options.onControlEvent]
 * @param {Function} [options.onRoomDeleted] - Callback when room is deleted/expired
 */
export function useWatchRoom({
  roomId,
  userId,
  userName,
  avatarUrl,
  inviteCode,
  forceHost = false,
  onControlEvent,
  onRoomDeleted,
}) {
  const stompRef = useRef(null);
  const unsubscribeRef = useRef(null);
  const unsubscribePersonalRef = useRef(null);
  const heartbeatTimerRef = useRef(null);
  const lastPingTimeRef = useRef(0);
  const hasJoinedRef = useRef(false); // ✅ Prevent duplicate JOIN

  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);

  /** @type {[WatchState, Function]} */
  const [state, setState] = useState({
    members: [],
    messages: [],
    sync: {
      playing: false,
      positionMs: 0,
      playbackRate: 1.0,
      serverTimeMs: Date.now(),
    },
    latencyMs: 0,
    isHost: false,
  });

  const [messageCursor, setMessageCursor] = useState(null);

  /**
   * Handle incoming WebSocket event
   */
  const handleEvent = useCallback(
    /** @param {WsEvent} event */
    (event) => {
      DEBUG_ENABLED && console.log('[useWatchRoom] Received event', event);

      switch (event.type) {
        case WS_TYPES.JOIN: {
          DEBUG_ENABLED && console.log('[useWatchRoom] JOIN event - senderId:', event.senderId, 'currentUserId:', userId);
          
          // Add member to list
          setState((prev) => {
            // Check if member already exists
            const exists = prev.members.find((m) => m.userId === event.senderId);
            
            DEBUG_ENABLED && console.log('[useWatchRoom] JOIN - Member exists?', exists, 'Current members:', prev.members.length);
            
            // If exists, update lastSeenAt
            if (exists) {
              DEBUG_ENABLED && console.log('[useWatchRoom] JOIN - Updating existing member');
              return {
                ...prev,
                members: prev.members.map((m) =>
                  m.userId === event.senderId
                    ? { ...m, lastSeenAt: event.createdAt }
                    : m
                ),
              };
            }

            // Add new member
            const newMember = {
              userId: event.senderId,
              userName: event.senderName,
              avatarUrl: event.avatarUrl,
              role: event.payload?.role || 'MEMBER',
              lastSeenAt: event.createdAt,
            };

            DEBUG_ENABLED && console.log('[useWatchRoom] JOIN - Adding new member:', newMember);
            DEBUG_ENABLED && console.log('[useWatchRoom] JOIN - New member count will be:', prev.members.length + 1);

            return {
              ...prev,
              members: [...prev.members, newMember],
              messages: [
                ...prev.messages,
                {
                  type: MESSAGE_TYPES.SYSTEM,
                  content: `${event.senderName} đã tham gia phòng`,
                  createdAt: event.createdAt || new Date().toISOString(),
                },
              ],
            };
          });

          // If this JOIN is for current user, backend should send SYNC_STATE
          // But we can also request it explicitly (already handled by backend)
          break;
        }

        case WS_TYPES.LEAVE: {
          // Remove member
          setState((prev) => ({
            ...prev,
            members: prev.members.filter((m) => m.userId !== event.senderId),
            messages: [
              ...prev.messages,
              {
                type: MESSAGE_TYPES.SYSTEM,
                content: `${event.senderName} đã rời phòng`,
                createdAt: event.createdAt || new Date().toISOString(),
              },
            ],
          }));
          break;
        }

        case WS_TYPES.MEMBER_LIST: {
          // Backend sends full member list (usually after JOIN)
          const members = event.payload?.members || [];
          
          DEBUG_ENABLED && console.log('[useWatchRoom] ===== MEMBER_LIST EVENT =====');
          DEBUG_ENABLED && console.log('[useWatchRoom] MEMBER_LIST - Current userId:', userId);
          DEBUG_ENABLED && console.log('[useWatchRoom] MEMBER_LIST - Members count:', members.length);
          DEBUG_ENABLED && console.log('[useWatchRoom] MEMBER_LIST - Members:', JSON.stringify(members, null, 2));
          DEBUG_ENABLED && console.log('[useWatchRoom] ================================');

          setState((prev) => {
            DEBUG_ENABLED && console.log('[useWatchRoom] MEMBER_LIST - Previous members count:', prev.members.length);
            DEBUG_ENABLED && console.log('[useWatchRoom] MEMBER_LIST - Setting new members count:', members.length);
            
            return {
              ...prev,
              members: members.map((m) => ({
                userId: m.userId,
                userName: m.userName || m.name || 'Unknown',
                avatarUrl: m.avatarUrl || m.avatar,
                role: m.role || 'MEMBER',
                lastSeenAt: m.lastSeenAt || new Date().toISOString(),
              })),
            };
          });
          break;
        }

        case WS_TYPES.CHAT: {
          // Add chat message
          setState((prev) => ({
            ...prev,
            messages: [
              ...prev.messages,
              {
                type: MESSAGE_TYPES.CHAT,
                senderId: event.senderId,
                senderName: event.senderName,
                avatarUrl: event.avatarUrl,
                content: event.payload?.text,
                createdAt: event.createdAt || new Date().toISOString(),
              },
            ],
          }));
          break;
        }

        case WS_TYPES.SYNC_STATE: {
          // Update sync state
          const { playing, positionMs, playbackRate, serverTimeMs } =
            event.payload || {};

          DEBUG_ENABLED && console.log('[useWatchRoom] SYNC_STATE received', {
            playing,
            positionMs,
            playbackRate,
            serverTimeMs,
          });

          setState((prev) => ({
            ...prev,
            sync: {
              playing: playing ?? prev.sync.playing,
              positionMs: positionMs ?? prev.sync.positionMs,
              playbackRate: playbackRate ?? prev.sync.playbackRate,
              serverTimeMs: serverTimeMs ?? Date.now(),
            },
          }));

          // Forward to control handler (for video sync)
          onControlEvent?.(event);
          break;
        }

        case WS_TYPES.PLAY:
        case WS_TYPES.PAUSE:
        case WS_TYPES.SEEK: {
          // Update local sync state from control events
          const { positionMs, playbackRate = 1.0 } = event.payload || {};

          setState((prev) => ({
            ...prev,
            sync: {
              ...prev.sync,
              playing: event.type === WS_TYPES.PLAY,
              positionMs: positionMs ?? prev.sync.positionMs,
              playbackRate: playbackRate ?? prev.sync.playbackRate,
              serverTimeMs: Date.now(),
            },
          }));

          // Forward control events to video player
          onControlEvent?.(event);
          break;
        }

        case WS_TYPES.PONG: {
          // Calculate latency
          const serverTime = event.payload?.serverTimeMs || Date.now();
          const now = Date.now();
          const latency = Math.round((now - lastPingTimeRef.current) / 2);

          setState((prev) => ({
            ...prev,
            latencyMs: latency,
          }));
          break;
        }

        case WS_TYPES.SYSTEM: {
          // System message
          setState((prev) => ({
            ...prev,
            messages: [
              ...prev.messages,
              {
                type: MESSAGE_TYPES.SYSTEM,
                content: event.payload?.text || 'System message',
                createdAt: event.createdAt || new Date().toISOString(),
              },
            ],
          }));
          break;
        }

        case 'ROOM_DELETED': {
          // Handle room deleted/expired event
          const reason = event.payload?.reason || 'UNKNOWN';
          const reasonText = reason === 'EXPIRED' ? 'đã hết hạn' : 'đã bị xóa';
          
          // Reset joined flag
          hasJoinedRef.current = false;
          
          // Show system message
          setState((prev) => ({
            ...prev,
            messages: [
              ...prev.messages,
              {
                type: MESSAGE_TYPES.SYSTEM,
                content: `⚠️ Phòng ${reasonText}. Kết nối sẽ bị đóng.`,
                createdAt: event.createdAt || new Date().toISOString(),
              },
            ],
          }));

          // Call callback if provided
          if (onRoomDeleted) {
            onRoomDeleted({ reason, reasonText });
          }

          break;
        }

        case 'ERROR': {
          // Handle error event (room deleted/expired when joining)
          const errorMessage = event.payload?.message || 'Unknown error';
          
          console.error('[useWatchRoom] ERROR event received:', errorMessage);
          
          // Reset joined flag on error
          hasJoinedRef.current = false;
          
          // Check if room deleted/expired error
          if (errorMessage.includes('deleted') || errorMessage.includes('expired')) {
            const reasonText = errorMessage.includes('expired') ? 'đã hết hạn' : 'đã bị xóa';
            
            // Show system message
            setState((prev) => ({
              ...prev,
              messages: [
                ...prev.messages,
                {
                  type: MESSAGE_TYPES.SYSTEM,
                  content: `⚠️ Lỗi: Phòng ${reasonText}`,
                  createdAt: event.createdAt || new Date().toISOString(),
                },
              ],
            }));

            // Call callback if provided (reuse onRoomDeleted for consistency)
            if (onRoomDeleted) {
              const reason = errorMessage.includes('expired') ? 'EXPIRED' : 'DELETED';
              onRoomDeleted({ reason, reasonText });
            }
          } else {
            // Other errors - show in system message
            setState((prev) => ({
              ...prev,
              messages: [
                ...prev.messages,
                {
                  type: MESSAGE_TYPES.SYSTEM,
                  content: `⚠️ Lỗi: ${errorMessage}`,
                  createdAt: event.createdAt || new Date().toISOString(),
                },
              ],
            }));
          }
          
          break;
        }

        default:
          console.warn('[useWatchRoom] Unknown event type', event.type);
      }
    },
    [onControlEvent, onRoomDeleted]
  );

  /**
   * Send heartbeat ping
   */
  const sendPing = useCallback(() => {
    if (!stompRef.current?.connected) return;

    lastPingTimeRef.current = Date.now();

    stompRef.current.send(`/app/rooms/${roomId}/ping`, {
      type: WS_TYPES.PING,
      roomId,
      senderId: userId,
      payload: {
        clientTimeMs: Date.now(),
      },
    });
  }, [roomId, userId]);

  /**
   * Start heartbeat
   */
  const startHeartbeat = useCallback(() => {
    stopHeartbeat();

    heartbeatTimerRef.current = setInterval(() => {
      sendPing();
    }, WATCH_CONFIG.HEARTBEAT_INTERVAL);

    // Send first ping immediately
    sendPing();
  }, [sendPing]);

  /**
   * Stop heartbeat
   */
  const stopHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
  }, []);

  /**
   * Fetch initial data
   */
  const fetchInitialData = useCallback(async () => {
    try {
      // Try to fetch members from API (if backend supports REST API)
      const membersResponse = await watchRoomApi.getMembers(roomId);
      
      DEBUG_ENABLED && console.log('[useWatchRoom] Fetched initial members from API:', membersResponse);
      
      // Backend returns {members: Array, count: number, roomId: string}
      const members = Array.isArray(membersResponse) 
        ? membersResponse 
        : (membersResponse?.members || []);
      
      DEBUG_ENABLED && console.log('[useWatchRoom] Extracted members array:', members);
      
      // Fetch recent messages
      const { messages, nextCursor } = await watchRoomApi.searchMessages(
        roomId,
        { limit: WATCH_CONFIG.PAGINATION_LIMIT }
      );

      // Check if current user is host
      // Priority: 1) forceHost from URL, 2) Backend role, 3) First member in room (auto-host)
      const currentMember = members.find((m) => m.userId === userId);
      const isHost = forceHost || currentMember?.role === 'OWNER' || members.length === 0;

      setState((prev) => {
        // Replace members entirely from API (this is initial load)
        // API should return all members including Host
        DEBUG_ENABLED && console.log('[useWatchRoom] Setting initial members from API:', members.length);
        
        return {
          ...prev,
          members: members, // Use API data as source of truth
          messages: Array.isArray(messages) ? messages.map((msg) => ({
            ...msg,
            type: MESSAGE_TYPES.CHAT,
          })) : [],
          isHost,
        };
      });

      setMessageCursor(nextCursor);
    } catch (error) {
      console.warn('[useWatchRoom] REST API not available (expected for WebSocket-only backend)', error.message);
      
      // Backend doesn't have REST API - rely purely on WebSocket events
      // This is OK - members will be populated via JOIN events
      setState((prev) => ({
        ...prev,
        isHost: forceHost || false, // Will be determined by backend via JOIN response
        messages: [{
          type: MESSAGE_TYPES.SYSTEM,
          content: '🔌 Đã kết nối WebSocket. Danh sách thành viên sẽ cập nhật qua events.',
          createdAt: new Date().toISOString(),
        }],
      }));
    }
  }, [roomId, userId, forceHost]);

  /**
   * Connect to room
   */
  const connect = useCallback(() => {
    // DEBUG_ENABLED && console.log('[useWatchRoom] Connecting to room', roomId);

    const stomp = getStompClient();
    stompRef.current = stomp;

    stomp.connect({
      onConnect: async () => {
        // DEBUG_ENABLED && console.log('[useWatchRoom] Connected');
        setIsConnected(true);
        setIsReconnecting(false);

        // Subscribe to room broadcast events
        unsubscribeRef.current = stomp.subscribeRoom(roomId, handleEvent);

        // Subscribe to personal queue for SYNC_STATE and PONG
        unsubscribePersonalRef.current = stomp.subscribe('/user/queue/reply', handleEvent);

        // ✅ Prevent duplicate JOIN (especially on reconnect)
        if (hasJoinedRef.current) {
          // console.warn('[useWatchRoom] ⚠️ Already joined room, skipping JOIN event');
          // Just request sync state instead
          // DEBUG_ENABLED && console.log('[useWatchRoom] Requesting sync state after reconnect...');
          stomp.send(`/app/rooms/${roomId}/sync`, {
            senderId: userId,
          });
          return;
        }

        // ⚠️ CRITICAL: Fetch initial data BEFORE sending JOIN
        // This ensures we have the member list before JOIN events arrive
        await fetchInitialData();

        // Send JOIN event AFTER fetching data (first time only)
        // console.log('[useWatchRoom] 🔵 Sending JOIN event to room:', roomId);
        stomp.send(`/app/rooms/${roomId}/join`, {
          senderId: userId,
          senderName: userName,
          avatarUrl,
          payload: {
            inviteCode,
          },
        });
        
        // Mark as joined
        hasJoinedRef.current = true;

        // Start heartbeat
        startHeartbeat();

        // Request sync state after a brief delay (backend should send automatically)
        // This is a fallback in case backend doesn't send SYNC_STATE after JOIN
        setTimeout(() => {
          // DEBUG_ENABLED && console.log('[useWatchRoom] Requesting initial sync state...');
          // Backend should have already sent SYNC_STATE via personal queue
          // If not received within 1 second, we might need to implement a request mechanism
        }, 1000);
      },

      onDisconnect: () => {
        // DEBUG_ENABLED && console.log('[useWatchRoom] Disconnected');
        setIsConnected(false);
        stopHeartbeat();
      },

      onError: (error) => {
        console.error('[useWatchRoom] Error', error);
        setIsReconnecting(true);
      },
    });
  }, [
    roomId,
    userId,
    userName,
    avatarUrl,
    inviteCode,
    handleEvent,
    fetchInitialData,
    startHeartbeat,
    stopHeartbeat,
  ]);

  /**
   * Disconnect from room
   */
  const disconnect = useCallback(() => {
    // console.log('[useWatchRoom] Disconnecting from room');

    // Send LEAVE event
    if (stompRef.current?.connected) {
      try {
        stompRef.current.send(`/app/rooms/${roomId}/leave`, {
          senderId: userId,
          senderName: userName,
        });
        // console.log('[useWatchRoom] LEAVE event sent');
      } catch (error) {
        console.error('[useWatchRoom] Failed to send LEAVE:', error);
        
        // Fallback: Use Beacon API for reliable delivery on page close
        try {
          const leavePayload = JSON.stringify({
            type: 'LEAVE',
            roomId,
            senderId: userId,
            senderName: userName,
            createdAt: new Date().toISOString(),
          });
          
          // Send via Beacon (survives page unload)
          navigator.sendBeacon(
            `${process.env.REACT_APP_API_BASE || process.env.REACT_APP_API_BASE_URL}/watchrooms/${roomId}/leave`,
            new Blob([leavePayload], { type: 'application/json' })
          );
          // console.log('[useWatchRoom] LEAVE sent via Beacon API');
        } catch (beaconError) {
          console.error('[useWatchRoom] Beacon API failed:', beaconError);
        }
      }
    }

    // Stop heartbeat
    stopHeartbeat();

    // Reset joined flag
    hasJoinedRef.current = false;

    // Unsubscribe room broadcast
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    // Unsubscribe personal queue
    if (unsubscribePersonalRef.current) {
      unsubscribePersonalRef.current();
      unsubscribePersonalRef.current = null;
    }

    // Disconnect WebSocket
    if (stompRef.current) {
      stompRef.current.disconnect();
      stompRef.current = null;
    }

    setIsConnected(false);
    setIsReconnecting(false);
  }, [roomId, userId, userName, stopHeartbeat]);

  /**
   * Send chat message
   */
  const sendChat = useCallback(
    (text) => {
      if (!stompRef.current?.connected || !text.trim()) return;

      stompRef.current.send(`/app/rooms/${roomId}/chat`, {
        senderId: userId,
        senderName: userName,
        avatarUrl,
        payload: {
          text: text.trim(),
        },
      });
    },
    [roomId, userId, userName, avatarUrl]
  );

  /**
   * Send PLAY control
   */
  const play = useCallback(
    (positionMs = 0) => {
      if (!stompRef.current?.connected) return;

      stompRef.current.send(`/app/rooms/${roomId}/control`, {
        senderId: userId,
        payload: {
          controlType: 'PLAY',
          positionMs,
          playbackRate: 1.0,
        },
      });
    },
    [roomId, userId]
  );

  /**
   * Send PAUSE control
   */
  const pause = useCallback(
    (positionMs = 0) => {
      if (!stompRef.current?.connected) return;

      stompRef.current.send(`/app/rooms/${roomId}/control`, {
        senderId: userId,
        payload: {
          controlType: 'PAUSE',
          positionMs,
        },
      });
    },
    [roomId, userId]
  );

  /**
   * Send SEEK control
   */
  const seek = useCallback(
    (positionMs) => {
      if (!stompRef.current?.connected) return;

      stompRef.current.send(`/app/rooms/${roomId}/control`, {
        senderId: userId,
        payload: {
          controlType: 'SEEK',
          positionMs,
        },
      });
    },
    [roomId, userId]
  );

  /**
   * Load more messages
   */
  const loadMoreMessages = useCallback(async () => {
    if (!messageCursor) return;

    try {
      const { messages, nextCursor } = await watchRoomApi.searchMessages(
        roomId,
        {
          limit: WATCH_CONFIG.PAGINATION_LIMIT,
          cursor: messageCursor,
        }
      );

      setState((prev) => ({
        ...prev,
        messages: [
          ...messages.map((msg) => ({
            ...msg,
            type: MESSAGE_TYPES.CHAT,
          })),
          ...prev.messages,
        ],
      }));

      setMessageCursor(nextCursor);
    } catch (error) {
      console.error('[useWatchRoom] Failed to load more messages', error);
    }
  }, [roomId, messageCursor]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    state,
    connect,
    disconnect,
    sendChat,
    play,
    pause,
    seek,
    loadMoreMessages,
    isConnected,
    isReconnecting,
  };
}

export default useWatchRoom;
