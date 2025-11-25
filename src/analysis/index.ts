/**
 * Analysis module exports
 *
 * Provides AI-powered commit analysis capabilities
 */

export { CommitAnalyzer } from './commit-analyzer';
export { OpenAIProvider } from './openai-provider';

export type {
  AnalysisResult,
  AnalysisMetadata,
  CommitAnalysis,
  AnalyzerOptions,
  AnalysisContext,
  OpenAIAnalysisResponse,
  BatchAnalysisResult,
  AnalysisFailure,
  BatchAnalysisSummary,
  AIProvider,
  StakeholderUpdate,
  CommitAnalysisWithUpdates,
} from './types';
