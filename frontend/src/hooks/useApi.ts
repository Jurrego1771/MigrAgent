import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  migrationApi,
  templateApi,
  csvApi,
  alertApi,
  settingsApi,
} from '../services/api';
import { MappingConfig, RetryPolicy } from '../types';

// ==================== Migrations ====================

export const useMigrations = () => {
  return useQuery({
    queryKey: ['migrations'],
    queryFn: migrationApi.list,
  });
};

export const useMigration = (id: string) => {
  return useQuery({
    queryKey: ['migration', id],
    queryFn: () => migrationApi.getById(id),
    enabled: !!id,
  });
};

export const useCreateMigration = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: migrationApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['migrations'] });
    },
  });
};

export const useUpdateMigration = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...params }: { id: string } & Parameters<typeof migrationApi.update>[1]) =>
      migrationApi.update(id, params),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['migration', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['migrations'] });
    },
  });
};

export const useDeleteMigration = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: migrationApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['migrations'] });
    },
  });
};

export const useValidateMigration = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, file, checkUrls }: { id: string; file: File; checkUrls?: boolean }) =>
      migrationApi.validate(id, file, checkUrls),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['migration', variables.id] });
    },
  });
};

export const useMigrationValidation = (id: string) => {
  return useQuery({
    queryKey: ['migration', id, 'validation'],
    queryFn: () => migrationApi.getValidation(id),
    enabled: !!id,
  });
};

export const useCreateInMediastream = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: migrationApi.createInMediastream,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['migration', id] });
    },
  });
};

export const useStartMigration = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: migrationApi.start,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['migration', id] });
      queryClient.invalidateQueries({ queryKey: ['migrations'] });
    },
  });
};

export const useStopMigration = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: migrationApi.stop,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['migration', id] });
      queryClient.invalidateQueries({ queryKey: ['migrations'] });
    },
  });
};

export const useRetryMigration = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: migrationApi.retry,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['migration', id] });
    },
  });
};

export const useResumeMigration = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: migrationApi.resume,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['migration', id] });
    },
  });
};

export const useMigrationStats = (id: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: ['migration', id, 'stats'],
    queryFn: () => migrationApi.getStats(id),
    enabled: !!id && enabled,
    refetchInterval: 5000, // Refrescar cada 5 segundos
  });
};

export const useMigrationLogs = (
  id: string,
  params?: { level?: string[]; category?: string; limit?: number }
) => {
  return useQuery({
    queryKey: ['migration', id, 'logs', params],
    queryFn: () => migrationApi.getLogs(id, params),
    enabled: !!id,
  });
};

export const useMigrationStatsHistory = (id: string) => {
  return useQuery({
    queryKey: ['migration', id, 'stats-history'],
    queryFn: () => migrationApi.getStatsHistory(id),
    enabled: !!id,
    refetchInterval: 30000,
  });
};

// ==================== Templates ====================

export const useTemplates = () => {
  return useQuery({
    queryKey: ['templates'],
    queryFn: templateApi.list,
  });
};

export const useTemplate = (id: string) => {
  return useQuery({
    queryKey: ['template', id],
    queryFn: () => templateApi.getById(id),
    enabled: !!id,
  });
};

export const useCreateTemplate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: templateApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });
};

export const useUpdateTemplate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...params }: { id: string } & Parameters<typeof templateApi.update>[1]) =>
      templateApi.update(id, params),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['template', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });
};

export const useDeleteTemplate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: templateApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });
};

export const useDuplicateTemplate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      templateApi.duplicate(id, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });
};

export const useDetectTemplate = () => {
  return useMutation({
    mutationFn: templateApi.detect,
  });
};

// ==================== CSV ====================

export const useAnalyzeCSV = () => {
  return useMutation({
    mutationFn: csvApi.analyze,
  });
};

export const useValidateCSV = () => {
  return useMutation({
    mutationFn: ({
      file,
      mappings,
      checkUrls,
    }: {
      file: File;
      mappings?: MappingConfig[];
      checkUrls?: boolean;
    }) => csvApi.validate(file, mappings, checkUrls),
  });
};

export const useCheckUrls = () => {
  return useMutation({
    mutationFn: csvApi.checkUrls,
  });
};

export const useCheckUrl = () => {
  return useMutation({
    mutationFn: csvApi.checkUrl,
  });
};

export const useMapperOptions = () => {
  return useQuery({
    queryKey: ['mapperOptions'],
    queryFn: csvApi.getMapperOptions,
    staleTime: Infinity, // No cambia frecuentemente
  });
};

// ==================== Alerts ====================

export const useAlerts = (params?: {
  migrationId?: string;
  acknowledged?: boolean;
  limit?: number;
}) => {
  return useQuery({
    queryKey: ['alerts', params],
    queryFn: () => alertApi.list(params),
    refetchInterval: 30000, // Refrescar cada 30 segundos
  });
};

export const useAcknowledgeAlert = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: alertApi.acknowledge,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });
};

export const useAcknowledgeAllAlerts = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: alertApi.acknowledgeAll,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });
};

export const useUnreadAlertCount = () => {
  return useQuery({
    queryKey: ['alerts', 'unreadCount'],
    queryFn: alertApi.getUnreadCount,
    refetchInterval: 30000,
  });
};

// ==================== Settings ====================

export const useSettings = () => {
  return useQuery({
    queryKey: ['settings'],
    queryFn: settingsApi.get,
  });
};

export const useUpdateSettings = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: settingsApi.update,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });
};

export const useTestConnection = () => {
  return useMutation({
    mutationFn: settingsApi.testConnection,
  });
};
