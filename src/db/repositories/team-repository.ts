/**
 * Repository for managing teams in the database
 */

import { db } from '../connection';
import { teams } from '../schema';
import { eq, like } from 'drizzle-orm';

export interface CreateTeamParams {
  name: string;
  displayName?: string;
  description?: string;
}

export interface UpdateTeamParams {
  displayName?: string;
  description?: string;
}

/**
 * Create a new team
 */
export async function createTeam(params: CreateTeamParams) {
  const result = await db
    .insert(teams)
    .values({
      name: params.name,
      displayName: params.displayName || params.name,
      description: params.description,
    })
    .returning();

  return result[0];
}

/**
 * Get a team by ID
 */
export async function getTeamById(id: number) {
  const result = await db.select().from(teams).where(eq(teams.id, id)).limit(1);
  return result[0] || null;
}

/**
 * Get a team by name
 */
export async function getTeamByName(name: string) {
  const result = await db.select().from(teams).where(eq(teams.name, name)).limit(1);
  return result[0] || null;
}

/**
 * Get all teams
 */
export async function getAllTeams() {
  return db.select().from(teams).orderBy(teams.displayName);
}

/**
 * Update a team
 */
export async function updateTeam(id: number, params: UpdateTeamParams) {
  const result = await db
    .update(teams)
    .set({
      displayName: params.displayName,
      description: params.description,
    })
    .where(eq(teams.id, id))
    .returning();

  return result[0] || null;
}

/**
 * Delete a team
 */
export async function deleteTeam(id: number): Promise<boolean> {
  const result = await db.delete(teams).where(eq(teams.id, id)).returning({ id: teams.id });
  return result.length > 0;
}

/**
 * Search teams by name
 */
export async function searchTeams(searchTerm: string) {
  return db
    .select()
    .from(teams)
    .where(like(teams.name, `%${searchTerm}%`))
    .orderBy(teams.displayName);
}
