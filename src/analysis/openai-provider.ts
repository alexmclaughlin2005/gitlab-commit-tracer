/**
 * OpenAI provider for commit analysis using GPT-5
 *
 * Uses the new Responses API with the latest GPT-5 models
 */

import OpenAI from 'openai';
import type {
  AIProvider,
  AnalysisContext,
  AnalysisResult,
  AnalyzerOptions,
  OpenAIAnalysisResponse,
  StakeholderUpdate,
} from './types';

/**
 * Default options for OpenAI analysis
 */
const DEFAULT_OPTIONS: Required<Omit<AnalyzerOptions, 'systemInstructions'>> = {
  model: 'gpt-4o',
  maxTokens: 1000,
  temperature: 0.3,
  includeDiff: false,
  maxDiffSize: 5000,
};

/**
 * OpenAI provider implementation using GPT-5
 */
export class OpenAIProvider implements AIProvider {
  public readonly name = 'openai';
  private client: OpenAI;
  private defaultOptions: AnalyzerOptions;

  /**
   * Creates a new OpenAI provider
   *
   * @param apiKey - OpenAI API key (defaults to OPENAI_API_KEY env var)
   * @param options - Default analyzer options
   */
  constructor(apiKey?: string, options?: AnalyzerOptions) {
    this.client = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY,
    });
    this.defaultOptions = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Analyzes a commit chain using GPT-5
   *
   * @param context - The analysis context
   * @param options - Analysis options
   * @returns Analysis result
   */
  public async analyze(
    context: AnalysisContext,
    options?: AnalyzerOptions
  ): Promise<AnalysisResult> {
    const startTime = Date.now();
    const opts = { ...this.defaultOptions, ...options };

    try {
      // Build the analysis prompt
      const prompt = this.buildPrompt(context);

      // Call OpenAI Chat Completions API
      const response = await this.client.chat.completions.create({
        model: opts.model!,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: opts.temperature,
        max_tokens: opts.maxTokens,
      });

      // Parse the response
      const content = response.choices[0]?.message?.content || '{}';
      const analysisData = JSON.parse(content) as OpenAIAnalysisResponse;

      // Validate and transform to our format
      const result: AnalysisResult = {
        reason: analysisData.reason,
        approach: analysisData.approach,
        impact: analysisData.impact,
        alignment: analysisData.alignment,
        alignmentNotes: analysisData.alignment_notes,
        confidence: this.validateConfidence(analysisData.confidence),
        metadata: {
          analyzedAt: new Date(),
          durationMs: Date.now() - startTime,
          provider: this.name,
          model: opts.model!,
          tokensUsed: response.usage?.total_tokens,
          costUsd: this.calculateCost(response.usage?.total_tokens, opts.model!),
        },
      };

      return result;
    } catch (error: any) {
      throw new Error(`OpenAI analysis failed: ${error.message}`);
    }
  }

  /**
   * Builds the analysis prompt from context
   *
   * @param context - Analysis context
   * @returns Formatted prompt string
   */
  private buildPrompt(context: AnalysisContext): string {
    const sections: string[] = [];

    sections.push('You are analyzing a code commit in the context of its development lifecycle.');
    sections.push('');
    sections.push('COMMIT:');
    sections.push(`- SHA: ${context.commit.sha}`);
    sections.push(`- Message: ${context.commit.message}`);
    sections.push(`- Author: ${context.commit.author}`);
    sections.push(`- Timestamp: ${context.commit.timestamp}`);
    if (context.commit.filesChanged) {
      sections.push(`- Files Changed: ${context.commit.filesChanged}`);
    }
    if (context.commit.summary) {
      sections.push(`- Summary: ${context.commit.summary}`);
    }
    sections.push('');

    if (context.mergeRequest) {
      sections.push('MERGE REQUEST:');
      sections.push(`- IID: !${context.mergeRequest.iid}`);
      sections.push(`- Title: ${context.mergeRequest.title}`);
      sections.push(`- Description: ${this.truncate(context.mergeRequest.description, 500)}`);
      if (context.mergeRequest.discussionSummary) {
        sections.push(`- Discussion: ${context.mergeRequest.discussionSummary}`);
      }
      sections.push('');
    }

    if (context.issue) {
      sections.push('ISSUE:');
      sections.push(`- IID: #${context.issue.iid}`);
      sections.push(`- Title: ${context.issue.title}`);
      sections.push(`- Description: ${this.truncate(context.issue.description, 500)}`);
      sections.push(`- Labels: ${context.issue.labels.join(', ')}`);
      sections.push('');
    }

    if (context.epic) {
      sections.push('EPIC:');
      sections.push(`- ID: &${context.epic.id}`);
      sections.push(`- Title: ${context.epic.title}`);
      sections.push(`- Description: ${this.truncate(context.epic.description, 500)}`);
      if (context.epic.objectives && context.epic.objectives.length > 0) {
        sections.push('- Objectives:');
        context.epic.objectives.forEach((obj) => {
          sections.push(`  * ${obj}`);
        });
      }
      sections.push('');
    }

    sections.push('Please analyze this commit and provide:');
    sections.push('');
    sections.push('1. REASON: Why was this commit made? What problem does it solve?');
    sections.push('2. APPROACH: What technical approach was taken to solve the problem?');
    sections.push('3. IMPACT: How does this commit contribute to the epic\'s objectives?');
    sections.push('4. ALIGNMENT: Does this commit align with the stated issue and epic goals?');
    sections.push('5. CONFIDENCE: How confident are you in this analysis? (0.0-1.0)');
    sections.push('');
    sections.push('Provide your response in JSON format with these exact keys:');
    sections.push('{');
    sections.push('  "reason": "...",');
    sections.push('  "approach": "...",');
    sections.push('  "impact": "...",');
    sections.push('  "alignment": "aligned|partially-aligned|misaligned",');
    sections.push('  "alignment_notes": "...",');
    sections.push('  "confidence": 0.0-1.0');
    sections.push('}');

    return sections.join('\n');
  }

  /**
   * Truncates text to a maximum length
   *
   * @param text - Text to truncate
   * @param maxLength - Maximum length
   * @returns Truncated text
   */
  private truncate(text: string, maxLength: number): string {
    if (!text || text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength) + '...';
  }

  /**
   * Validates confidence score
   *
   * @param confidence - Raw confidence value
   * @returns Validated confidence (0.0 - 1.0)
   */
  private validateConfidence(confidence: number): number {
    if (confidence < 0) return 0;
    if (confidence > 1) return 1;
    return confidence;
  }

  /**
   * Generates stakeholder updates for different audiences
   *
   * @param context - The analysis context
   * @param analysis - The analysis result
   * @param options - Analysis options
   * @returns Stakeholder updates
   */
  public async generateUpdate(
    context: AnalysisContext,
    analysis: AnalysisResult,
    options?: AnalyzerOptions
  ): Promise<StakeholderUpdate> {
    const startTime = Date.now();
    const opts = { ...this.defaultOptions, ...options };

    try {
      // Build the update generation prompt
      const prompt = this.buildUpdatePrompt(context, analysis);

      // Call OpenAI Chat Completions API
      const response = await this.client.chat.completions.create({
        model: opts.model!,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: opts.temperature,
        max_tokens: opts.maxTokens,
      });

      // Parse the response
      const content = response.choices[0]?.message?.content || '{}';
      const updateData = JSON.parse(content) as {
        cpo_update: string;
        business_update: string;
      };

      const result: StakeholderUpdate = {
        technicalUpdate: updateData.cpo_update,
        businessUpdate: updateData.business_update,
        metadata: {
          generatedAt: new Date(),
          durationMs: Date.now() - startTime,
          provider: this.name,
          model: opts.model!,
          tokensUsed: response.usage?.total_tokens,
          costUsd: this.calculateCost(response.usage?.total_tokens, opts.model!),
        },
      };

      return result;
    } catch (error: any) {
      throw new Error(`OpenAI update generation failed: ${error.message}`);
    }
  }

  /**
   * Builds the update generation prompt
   *
   * @param context - Analysis context
   * @param analysis - Analysis result
   * @returns Formatted prompt string
   */
  private buildUpdatePrompt(context: AnalysisContext, analysis: AnalysisResult): string {
    const sections: string[] = [];

    sections.push('You are creating stakeholder updates for a code commit in a software application.');
    sections.push('');
    sections.push('IMPORTANT CONTEXT:');
    sections.push('- This is application code, NOT documentation/marketing content');
    sections.push('- The EPIC and ISSUE descriptions below explain WHAT FEATURE/AREA of the application this change affects');
    sections.push('- When you see terms like "docs", "documents", "project docs" - these refer to DOCUMENT MANAGEMENT features in the app (not documentation)');
    sections.push('- Always reference the Epic/Issue descriptions to understand what part of the application is being changed');
    sections.push('- The commit is a CODE CHANGE that implements or fixes something in the application');
    sections.push('');
    sections.push('COMMIT INFORMATION:');
    sections.push(`- SHA: ${context.commit.sha.substring(0, 8)}`);
    sections.push(`- Message: ${context.commit.message}`);
    sections.push(`- Author: ${context.commit.author}`);
    sections.push('');

    if (context.issue) {
      sections.push('ISSUE (DESCRIBES THE FEATURE/AREA BEING CHANGED):');
      sections.push(`- Title: ${context.issue.title}`);
      sections.push(`- Description: ${this.truncate(context.issue.description, 300)}`);
      if (context.issue.labels && context.issue.labels.length > 0) {
        sections.push(`- Labels: ${context.issue.labels.join(', ')}`);
        const teamLabel = context.issue.labels.find(l => l.toLowerCase().startsWith('team:'));
        if (teamLabel) {
          sections.push(`- Team: ${teamLabel.substring(5)}`);
        }
      }
      sections.push('');
    }

    if (context.epic) {
      sections.push('EPIC (HIGH-LEVEL PROJECT CONTEXT - READ THIS CAREFULLY):');
      sections.push(`- Title: ${context.epic.title}`);
      sections.push(`- Description: ${this.truncate(context.epic.description, 300)}`);
      sections.push('  ^ This description explains WHAT PART of the application is being worked on');
      sections.push('');
    }

    sections.push('ANALYSIS:');
    sections.push(`- Reason: ${analysis.reason}`);
    sections.push(`- Approach: ${analysis.approach}`);
    sections.push(`- Impact: ${analysis.impact}`);
    sections.push(`- Alignment: ${analysis.alignment}`);
    sections.push('');

    sections.push('Generate TWO CONCISE versions of a status update:');
    sections.push('');
    sections.push('CRITICAL REMINDERS:');
    sections.push('- Each update will be sent to different audiences independently, so each must be self-contained');
    sections.push('- ALWAYS read the Epic/Issue descriptions to understand what APPLICATION FEATURE this commit affects');
    sections.push('- DO NOT assume "docs" means documentation - it likely means document management features in the app');
    sections.push('- Focus on the USER-FACING or BUSINESS IMPACT of the code change, not the code itself');
    sections.push('');
    sections.push('1. CPO UPDATE (for Chief Product Officer, product leaders, developers, PMs, architects):');
    sections.push('   - START with project/epic name and team in format: "[Epic Name] (Team: [Team]) - " (if available)');
    sections.push('   - If no epic, use issue title; if no team, omit team portion');
    sections.push('   - Reference the Epic/Issue to understand what APPLICATION FEATURE this affects');
    sections.push('   ');
    sections.push('   CRITICAL: This update must answer THREE questions for Product/Leadership:');
    sections.push('   1. WHERE ARE WE? - What is the current state and progress of this feature/fix?');
    sections.push('   2. WHEN IS IT AVAILABLE? - When can customers use this? Is it already available?');
    sections.push('   3. CAN WE COMMIT? - Is it safe to promise to customers/prospects?');
    sections.push('   ');
    sections.push('   - Write as if the reader has no context from previous updates');
    sections.push('   - Focus on CUSTOMER IMPACT and business readiness, not implementation details');
    sections.push('   - Include specific timelines, confidence levels, or availability status');
    sections.push('   - Can use technical terminology but prioritize business value');
    sections.push('   - If this is infrastructure/non-customer-visible work, state what it unblocks');
    sections.push('   - Length: EXACTLY 2-4 sentences, keep it brief and actionable');
    sections.push('   ');
    sections.push('   EXAMPLES OF GOOD CPO UPDATES:');
    sections.push('   - "We\'ve completed the migration to the new search infrastructure to prevent partial search responses and it\'s running stable in production for 3 weeks. Performance is 40% faster than the old system with zero incidents. We\'re ready for general availability next week - safe to commit to any customer or prospect."');
    sections.push('   - "Infrastructure optimization for report generation complete. Reduces processing time by 60%, enabling future work on real-time reporting features. Not customer-visible yet, but unblocks Q1 roadmap items."');
    sections.push('   - "We\'re mid-flight on the custom update feature for Project Activity feed, on schedule through our 4 engineering cycles. We\'re expecting 6 weeks to customer availability, but we\'re 70% confident we\'ll have a timeline in 2 weeks once we complete the next milestone."');
    sections.push('');
    sections.push('2. BUSINESS UPDATE (for marketing, sales, support, GTM, executives):');
    sections.push('   - START with project/epic name and team in format: "[Epic Name] (Team: [Team]) - " (if available)');
    sections.push('   - If no epic, use issue title; if no team, omit team portion');
    sections.push('   - Reference the Epic/Issue to understand what APPLICATION FEATURE this affects');
    sections.push('   - Audience needs quick understanding with minimal technical jargon');
    sections.push('   - Focus on business value and user impact');
    sections.push('   - Explain the problem being solved in simple terms');
    sections.push('   - Connect to customer/business outcomes when possible');
    sections.push('   - Avoid technical implementation details');
    sections.push('   - Length: EXACTLY 1 sentence, be extremely concise');
    sections.push('');
    sections.push('Provide your response in JSON format:');
    sections.push('{');
    sections.push('  "cpo_update": "...",');
    sections.push('  "business_update": "..."');
    sections.push('}');

    return sections.join('\n');
  }

  /**
   * Calculates estimated cost based on tokens and model
   *
   * @param tokens - Number of tokens used
   * @param model - Model name
   * @returns Cost in USD
   */
  private calculateCost(tokens: number | undefined, model: string): number | undefined {
    if (!tokens) return undefined;

    // GPT-4o pricing (as of 2024): $5 per million input tokens, $15 per million output tokens
    // Using a blended average of $10 per million tokens
    const pricePerMillionTokens = model.includes('gpt-4') ? 10.0 : 5.0;
    return (tokens / 1_000_000) * pricePerMillionTokens;
  }
}
