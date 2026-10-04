import { useEffect, useRef } from "react";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { decodeJwtPayload } from "./jwt";

/**
 * Subscribes to this tenant's `/topic/restaurant/{tenantDbKey}/{topic}` and
 * calls `onMessage` with each pushed snapshot (see RestaurantServiceImpl's
 * broadcastTables/broadcastKitchen -- the server always sends a full,
 * ready-to-render array, never a delta, so `onMessage` can just be a
 * `setState`).
 *
 * This is additive to polling, not a replacement for it: callers should keep
 * their existing `setInterval` refresh as a safety net (e.g. a much longer
 * interval, or the same one) in case the socket drops on a flaky tablet
 * Wi-Fi -- reconnection happens automatically, but a poll fallback means a
 * dropped connection degrades to "a bit stale" instead of "frozen".
 */
export function useRestaurantSocket<T>(topic: "tables" | "kitchen" | "kots" | "menu", onMessage: (data: T) => void) {
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    const token = sessionStorage.getItem("token");
    if (!token) return; // not logged in yet -- caller's polling covers this case

    const claims = decodeJwtPayload(token);
    const tenantDbKey = claims?.tenantDbKey;
    if (!tenantDbKey) return; // super admin session, or token shape we don't recognise -- skip WS silently

    const client = new Client({
      webSocketFactory: () => new SockJS(`${window.location.origin}/ws`) as any,
      connectHeaders: { Authorization: `Bearer ${token}` },
      reconnectDelay: 4000, // auto-retry if a tablet's Wi-Fi drops for a moment
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
    });

    client.onConnect = () => {
      client.subscribe(`/topic/restaurant/${tenantDbKey}/${topic}`, (msg) => {
        try {
          onMessageRef.current(JSON.parse(msg.body));
        } catch {
          // ignore a malformed frame -- the next poll/push will correct state
        }
      });
    };

    // Deliberately silent on error -- the polling fallback already in each
    // page keeps the UI correct; we don't want a toast every time a tablet's
    // wifi blips.
    client.onStompError = () => {};
    client.onWebSocketError = () => {};

    client.activate();
    return () => {
      client.deactivate();
    };
  }, [topic]);
}
