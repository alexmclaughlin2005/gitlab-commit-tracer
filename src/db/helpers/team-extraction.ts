/**
 * Helper functions for extracting team information from GitLab labels
 */

import { db } from '../connection';
import { teams } from '../schema';
import { eq } from 'drizzle-orm';

/**
 * Extract team name from a team label
 * @param label - Label string (e.g., "team::backend", "team::frontend-ui")
 * @returns Team name or null if not a team label
 */
export function extractTeamFromLabel(label: string): string | null {
  const teamPrefix = 'team::';
  if (!label.toLowerCase().startsWith(teamPrefix)) {
    return null;
  }
  return label.substring(teamPrefix.length).trim();
}

/**
 * Extract all team names from an array of labels
 * @param labels - Array of label strings
 * @returns Array of team names
 */
export function extractTeamsFromLabels(labels: string[]): string[] {
  return labels
    .map(extractTeamFromLabel)
    .filter((team): team is string => team !== null);
}

/**
 * Ensure a team exists in the database, creating it if necessary
 * @param teamName - Name of the team (e.g., "backend", "frontend-ui")
 * @returns Team ID
 */
export async function ensureTeamExists(teamName: string): Promise<number> {
  // Check if team exists
  const existingTeams = await db
    .select()
    .from(teams)
    .where(eq(teams.name, teamName))
    .limit(1);

  if (existingTeams.length > 0) {
    return existingTeams[0].id;
  }

  // Create new team
  const displayName = teamName
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  const newTeams = await db
    .insert(teams)
    .values({
      name: teamName,
      displayName,
    })
    .returning({ id: teams.id });

  return newTeams[0].id;
}

/**
 * Ensure multiple teams exist in the database
 * @param teamNames - Array of team names
 * @returns Array of team IDs
 */
export async function ensureTeamsExist(teamNames: string[]): Promise<number[]> {
  const teamIds: number[] = [];

  for (const teamName of teamNames) {
    const teamId = await ensureTeamExists(teamName);
    teamIds.push(teamId);
  }

  return teamIds;
}

/**
 * Extract team IDs from a commit chain's issue labels
 * @param issueLabels - Array of arrays of issue labels
 * @returns Array of unique team IDs
 */
export async function extractTeamIdsFromIssues(
  issueLabels: string[][]
): Promise<number[]> {
  // Flatten all labels and extract unique team names
  const allLabels = issueLabels.flat();
  const teamNames = [...new Set(extractTeamsFromLabels(allLabels))];

  // Ensure all teams exist and get their IDs
  return ensureTeamsExist(teamNames);
}
