import { Request, Response } from 'express';
import { MediastreamService } from '../services/mediastream.service.js';
import { AuthService } from '../services/auth.service.js';

// Perfiles de calidad de video reconocidos, en orden descendente de calidad
const VIDEO_PROFILES_ORDERED = [
  '1080p', '1080p Low', '720p', '720p Low', '480p', '360p', '240p', '144p',
];

// Perfiles de audio
const AUDIO_PROFILES = ['aac', 'mp3', 'm4a'];

export class AccountController {
  /**
   * GET /api/account/info
   * Retorna información de la cuenta de Mediastream + módulos del JWT.
   */
  static async getInfo(req: Request, res: Response): Promise<void> {
    const service = await MediastreamService.fromActiveSession();

    const [accountData, modules] = await Promise.all([
      service.getAccountInfo(),
      AuthService.getModulesFromSession(),
    ]);

    const account = (accountData as Record<string, unknown>)?.account as Record<string, unknown> | undefined;

    // Normalizar auto_encoding_profiles
    const rawProfiles = account?.auto_encoding_profiles;
    const encodingProfiles: string[] = Array.isArray(rawProfiles)
      ? rawProfiles
      : typeof rawProfiles === 'object' && rawProfiles !== null
      ? Object.keys(rawProfiles as Record<string, unknown>)
      : [];

    // Detectar capacidades
    const hasVideoProfiles = encodingProfiles.some((p) =>
      VIDEO_PROFILES_ORDERED.includes(p)
    );
    const hasAudioProfiles = encodingProfiles.some((p) =>
      AUDIO_PROFILES.some((a) => p.toLowerCase().includes(a))
    );

    const advertisingConfig = account?.media_smart_ad_markers as Record<string, unknown> | undefined;
    const hasAdvertisingEnabled =
      !!(advertisingConfig?.enabled) ||
      !!(account?.media_default_ad_marker_preroll) ||
      !!(account?.media_default_ad_marker_postroll);

    // Checks de módulos clave
    const moduleChecks = {
      media: !!(modules?.media),
      migration: !!(modules?.migration),
      vod: hasVideoProfiles || !!(modules?.media),
      aod: hasAudioProfiles || !!(modules?.live_audio),
      advertising: !!(modules?.ad) || !!(modules?.vod_google_dai) || hasAdvertisingEnabled,
      drm: !!(modules?.drm),
    };

    // Extract AI settings from account.ai and ops.ai
    const aiConfig = (account?.ai as Record<string, unknown>) || {};
    const opsAi = ((accountData as Record<string, unknown>)?.ops as Record<string, unknown>)?.ai as Record<string, unknown> || {};
    const AI_FEATURES = ['transcription', 'metadata', 'chapters', 'highlights', 'article', 'i18n', 'thumbnails'] as const;
    const aiSettings: Record<string, { enabled: boolean; automatic: boolean; model?: string }> = {};
    for (const feature of AI_FEATURES) {
      const cfg = (aiConfig[feature] as Record<string, unknown>) || {};
      aiSettings[feature] = {
        enabled: opsAi[feature] === true,
        automatic: cfg.automatic === true,
        model: cfg.model as string | undefined,
      };
    }

    res.json({
      account: {
        id: accountData && (accountData as Record<string, unknown>).account
          ? ((accountData as Record<string, unknown>).account as Record<string, unknown>)?._id
          : null,
        name: typeof accountData === 'object' && accountData !== null
          ? (accountData as Record<string, unknown>).name
          : null,
        encodingProfiles,
        advertisingEnabled: hasAdvertisingEnabled,
        advertisingConfig: advertisingConfig || null,
        normalizeAudio: !!(account?.normalize_podcast_audio) || !!(account?.normalize_video_audio),
      },
      modules,
      moduleChecks,
      aiSettings,
    });
  }

  /**
   * GET /api/account/renditions
   * Retorna las rendition rules configuradas en la cuenta.
   */
  static async getRenditions(req: Request, res: Response): Promise<void> {
    const service = await MediastreamService.fromActiveSession();
    const activeProfiles = await service.getRenditionRules();

    const activeProfilesSet = new Set(activeProfiles);

    // Clasificar: qué perfiles de video estándar están activos y cuáles faltan
    const activeVideoProfiles = VIDEO_PROFILES_ORDERED.filter((p) => activeProfilesSet.has(p));
    const missingVideoProfiles = VIDEO_PROFILES_ORDERED.filter((p) => !activeProfilesSet.has(p));

    res.json({
      activeProfiles,
      activeVideoProfiles,
      missingVideoProfiles,
      allVideoProfiles: VIDEO_PROFILES_ORDERED,
    });
  }

  /**
   * GET /api/account/categories
   * Retorna categorías de la cuenta (para el wizard de mapeo).
   */
  static async getCategories(req: Request, res: Response): Promise<void> {
    const { search } = req.query as { search?: string };
    const service = await MediastreamService.fromActiveSession();
    const categories = await service.getCategories(search);
    res.json({ categories });
  }

  /**
   * GET /api/account/ia-settings
   * Probe de los settings de IA de SM2 — descubre qué devuelve el endpoint.
   */
  static async getIASettings(req: Request, res: Response): Promise<void> {
    const service = await MediastreamService.fromActiveSession();
    const result = await service.getAISettings();
    res.json(result);
  }
}
