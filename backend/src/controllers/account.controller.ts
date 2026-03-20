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
    });
  }

  /**
   * GET /api/account/renditions
   * Retorna las rendition rules configuradas en la cuenta.
   */
  static async getRenditions(req: Request, res: Response): Promise<void> {
    const service = await MediastreamService.fromActiveSession();
    const rules = await service.getRenditionRules();

    // Normalizar para el frontend
    const normalized = (rules as Record<string, unknown>[]).map((rule) => ({
      id: rule._id || rule.id,
      name: rule.name,
      code: rule.code,
      profileRange: rule.profile_range as { min: string; max: string } | undefined,
      profiles: Array.isArray(rule.profiles) ? rule.profiles : [],
    }));

    // Extraer todos los perfiles únicos activos
    const activeProfiles = new Set<string>();
    for (const rule of normalized) {
      if (rule.profileRange?.min) activeProfiles.add(rule.profileRange.min);
      if (rule.profileRange?.max) activeProfiles.add(rule.profileRange.max);
      for (const p of rule.profiles) activeProfiles.add(p as string);
    }

    // Clasificar: qué perfiles de video estándar están activos y cuáles faltan
    const activeVideoProfiles = VIDEO_PROFILES_ORDERED.filter((p) => activeProfiles.has(p));
    const missingVideoProfiles = VIDEO_PROFILES_ORDERED.filter((p) => !activeProfiles.has(p));

    res.json({
      rules: normalized,
      activeProfiles: Array.from(activeProfiles),
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
}
