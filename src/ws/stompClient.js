/**
 * STOMP WebSocket Client
 * Singleton client with auto-reconnect logic
 * @author Senior FE Developer
 * @version 1.0
 */

import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { WATCH_CONFIG } from '../types/watch';

// Debug logging (set to false to disable verbose logs)
const DEBUG_ENABLED = false;

const WS_URL = process.env.REACT_APP_WS_URL;

class StompClient {
  constructor() {
    this.client = null;
    this.subscriptions = new Map();
    this.reconnectAttempt = 0;
    this.reconnectTimer = null;
    this.isConnecting = false;
    this.callbacks = {
      onConnect: null,
      onDisconnect: null,
      onError: null,
    };
  }

  /**
   * Connect to WebSocket server
   * @param {Object} options
   * @param {Function} options.onConnect - Called when connected
   * @param {Function} options.onDisconnect - Called when disconnected
   * @param {Function} options.onError - Called on error
   */
  connect({ onConnect, onDisconnect, onError } = {}) {
    if (this.client?.connected) {
      DEBUG_ENABLED && console.log('[STOMP] Already connected');
      onConnect?.();
      return;
    }

    if (this.isConnecting) {
      DEBUG_ENABLED && console.log('[STOMP] Connection already in progress');
      return;
    }

    this.callbacks = { onConnect, onDisconnect, onError };
    this.isConnecting = true;

    DEBUG_ENABLED && console.log('[STOMP] Connecting to', WS_URL);

    this.client = new Client({
      webSocketFactory: () => new SockJS(WS_URL),
      reconnectDelay: 0, // We handle reconnect manually
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      debug: () => {
        // Disable debug logs in production
        // Enable only if needed for debugging: console.log('[STOMP Debug]', str);
      },

      onConnect: (frame) => {
        DEBUG_ENABLED && console.log('[STOMP] Connected');
        this.isConnecting = false;
        this.reconnectAttempt = 0;
        this.clearReconnectTimer();
        this.callbacks.onConnect?.(frame);
      },

      onDisconnect: (frame) => {
        DEBUG_ENABLED && console.log('[STOMP] Disconnected');
        this.isConnecting = false;
        this.callbacks.onDisconnect?.(frame);
      },

      onStompError: (frame) => {
        console.error('[STOMP] Error', frame);
        this.isConnecting = false;
        this.callbacks.onError?.(frame);
        this.scheduleReconnect();
      },

      onWebSocketError: (event) => {
        console.error('[STOMP] WebSocket Error', event);
        this.isConnecting = false;
        this.callbacks.onError?.(event);
        this.scheduleReconnect();
      },

      onWebSocketClose: (event) => {
        DEBUG_ENABLED && console.log('[STOMP] WebSocket Closed');
        this.isConnecting = false;
        this.scheduleReconnect();
      },
    });

    this.client.activate();
  }

  /**
   * Disconnect from server
   */
  disconnect() {
    DEBUG_ENABLED && console.log('[STOMP] Disconnecting...');
    this.clearReconnectTimer();
    this.reconnectAttempt = 0;

    // Unsubscribe all
    this.subscriptions.forEach((sub) => {
      try {
        sub.unsubscribe();
      } catch (err) {
        console.error('[STOMP] Error unsubscribing', err);
      }
    });
    this.subscriptions.clear();

    if (this.client) {
      try {
        this.client.deactivate();
      } catch (err) {
        console.error('[STOMP] Error deactivating', err);
      }
      this.client = null;
    }

    this.isConnecting = false;
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  scheduleReconnect() {
    if (this.reconnectTimer || this.callbacks.onConnect === null) {
      return; // Already scheduled or not needed
    }

    const delays = WATCH_CONFIG.RECONNECT_DELAYS;
    const delay = delays[Math.min(this.reconnectAttempt, delays.length - 1)];

    DEBUG_ENABLED && console.log(
      `[STOMP] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempt + 1})`
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectAttempt++;
      this.connect(this.callbacks);
    }, delay);
  }

  /**
   * Clear reconnect timer
   */
  clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * Subscribe to a destination
   * @param {string} destination - e.g., /topic/rooms/room_123
   * @param {Function} handler - Message handler
   * @returns {Function} Unsubscribe function
   */
  subscribe(destination, handler) {
    if (!this.client?.connected) {
      console.error('[STOMP] Cannot subscribe - not connected');
      return () => {};
    }

    DEBUG_ENABLED && console.log('[STOMP] Subscribing to', destination);

    const subscription = this.client.subscribe(destination, (message) => {
      try {
        const body = JSON.parse(message.body);
        handler(body);
      } catch (err) {
        console.error('[STOMP] Error parsing message', err);
      }
    });

    this.subscriptions.set(destination, subscription);

    // Return unsubscribe function
    return () => {
      DEBUG_ENABLED && console.log('[STOMP] Unsubscribing from', destination);
      subscription.unsubscribe();
      this.subscriptions.delete(destination);
    };
  }

  /**
   * Subscribe to room events
   * @param {string} roomId
   * @param {Function} handler
   * @returns {Function} Unsubscribe function
   */
  subscribeRoom(roomId, handler) {
    return this.subscribe(`/topic/rooms/${roomId}`, handler);
  }

  /**
   * Send message to destination
   * @param {string} destination - e.g., /app/rooms/room_123/join
   * @param {Object} body - Message body
   */
  send(destination, body = {}) {
    if (!this.client?.connected) {
      console.error('[STOMP] Cannot send - not connected');
      return;
    }

    DEBUG_ENABLED && console.log('[STOMP] Sending to', destination, body);

    this.client.publish({
      destination,
      body: JSON.stringify(body),
    });
  }

  /**
   * Check if connected
   */
  get connected() {
    return this.client?.connected || false;
  }
}

// Singleton instance
let instance = null;

/**
 * Get STOMP client instance
 */
export function getStompClient() {
  if (!instance) {
    instance = new StompClient();
  }
  return instance;
}

export default getStompClient;
