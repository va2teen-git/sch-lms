import campaignData from '../data/prince-campaign.json';

export interface PrinceCampaignStage {
  stage: number;
  mapLevel: number;
  title: string;
  health: number;
  time: number;
  skipCutscenes: boolean;
}

export interface PrinceStageSummary {
  stage: number;
  mapLevel: number;
  title: string;
}

const CAMPAIGN_STAGES: PrinceCampaignStage[] = (campaignData as PrinceCampaignStage[])
  .slice()
  .sort((a, b) => a.stage - b.stage);

const STAGE_BY_NUMBER = new Map<number, PrinceCampaignStage>(
  CAMPAIGN_STAGES.map((item) => [item.stage, item])
);

const STAGE_BY_MAP_LEVEL = new Map<number, PrinceCampaignStage>(
  CAMPAIGN_STAGES.map((item) => [item.mapLevel, item])
);

/** Returns ordered list of all Prince of Persia campaign stages. */
export function getCampaignStages(): PrinceCampaignStage[] {
  return CAMPAIGN_STAGES.slice();
}

/** Returns total number of stages configured in the campaign. */
export function getTotalCampaignStages(): number {
  return CAMPAIGN_STAGES.length;
}

/** Looks up a campaign stage configuration by 1-based stage index. */
export function getStageByNumber(stage: number): PrinceCampaignStage | null {
  return STAGE_BY_NUMBER.get(stage) ?? null;
}

/** Looks up a campaign stage configuration by PrinceJS mapLevel. */
export function getStageByMapLevel(mapLevel: number): PrinceCampaignStage | null {
  return STAGE_BY_MAP_LEVEL.get(mapLevel) ?? null;
}

/** Maps a campaign stage number to its underlying PrinceJS mapLevel. */
export function mapStageToLevel(stage: number): number | null {
  return STAGE_BY_NUMBER.get(stage)?.mapLevel ?? null;
}

/** Maps a PrinceJS mapLevel to its campaign stage number. */
export function mapLevelToStage(mapLevel: number): number | null {
  return STAGE_BY_MAP_LEVEL.get(mapLevel)?.stage ?? null;
}

/** Finds the first uncompleted campaign stage given a set/list of completed stage numbers. */
export function getNextCampaignStage(completedStages: Iterable<number>): PrinceCampaignStage | null {
  const completed = new Set<number>(completedStages);
  for (const item of CAMPAIGN_STAGES) {
    if (!completed.has(item.stage)) {
      return item;
    }
  }
  return null;
}

/** Resolves relative PrinceJS asset map path matching Game.js rules (< 90 standard, >= 90 custom). */
export function getPrinceMapRelativePath(mapLevel: number): string {
  const baseDir = mapLevel < 90 ? 'assets/maps' : 'assets/maps/custom';
  return `${baseDir}/level${mapLevel}.json`;
}
