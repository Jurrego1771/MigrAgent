import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io, Socket } from 'socket.io-client';
import { EnrichedStats, Alert } from '../types';

let _socket: Socket | null = null;

function getSocket(): Socket {
  if (!_socket) {
    _socket = io('/', { path: '/socket.io', transports: ['websocket', 'polling'] });
  }
  return _socket;
}

/**
 * Suscribe al canal de una migración y actualiza el cache de React Query
 * en tiempo real con los eventos emitidos por el servidor.
 */
export function useMigrationSocket(migrationId: string | undefined) {
  const queryClient = useQueryClient();
  const subscribedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!migrationId) return;

    const socket = getSocket();

    // Suscribirse al room de esta migración
    if (subscribedRef.current !== migrationId) {
      if (subscribedRef.current) {
        socket.emit('unsubscribe:migration', subscribedRef.current);
      }
      socket.emit('subscribe:migration', migrationId);
      subscribedRef.current = migrationId;
    }

    // Stats en tiempo real → actualizar cache sin refetch HTTP
    const onStats = (stats: EnrichedStats) => {
      queryClient.setQueryData(['migration', migrationId, 'stats'], stats);
    };

    // Cambio de estado → invalidar migración completa
    const onStatus = ({ status }: { status: string }) => {
      queryClient.setQueryData(
        ['migration', migrationId],
        (prev: Record<string, unknown> | undefined) =>
          prev ? { ...prev, status } : prev
      );
      queryClient.invalidateQueries({ queryKey: ['migrations'] });
    };

    // Nueva alerta → invalidar alertas
    const onAlert = (_alert: Alert) => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    };

    socket.on('migration:stats', onStats);
    socket.on('migration:status', onStatus);
    socket.on('migration:alert', onAlert);

    return () => {
      socket.off('migration:stats', onStats);
      socket.off('migration:status', onStatus);
      socket.off('migration:alert', onAlert);
    };
  }, [migrationId, queryClient]);
}

/**
 * Escucha alertas globales (para el badge en el header).
 */
export function useGlobalAlertSocket() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = getSocket();

    const onNewAlert = (_alert: Alert) => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    };

    socket.on('alerts:new', onNewAlert);
    return () => {
      socket.off('alerts:new', onNewAlert);
    };
  }, [queryClient]);
}
