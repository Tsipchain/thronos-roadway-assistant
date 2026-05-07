/**
 * Dispatch Service — Real-time job matching & assignment
 *
 * Handles:
 * - Finding nearby technicians via Redis GEO
 * - Broadcasting dispatch notifications via Socket.IO
 * - Tracking dispatch attempts and timeouts
 * - Auto-escalating to next technician if rejected
 */

import { ServiceRequest, User, DispatchAttempt } from '@prisma/client';
import { prisma } from './prisma';
import { findNearbyInCache, upsertTechnicianLocation } from './location-cache';
import { getSocketServer } from './socket-server';
import { distanceKm, estimateMinutes } from './geo';

const DISPATCH_TIMEOUT_SECONDS = 30;  // Tech has 30s to accept/reject
const MAX_DISPATCH_ATTEMPTS = 5;      // Try up to 5 techs before escalating

export interface DispatchJob {
  requestId: string;
  customerId: string;
  latitude: number;
  longitude: number;
  serviceType: string;
  estimatedPrice: number;
  description?: string;
}

export interface DispatchCandidate {
  userId: string;
  technicianId: string;
  name: string;
  phone: string;
  rating: number;
  distanceKm: number;
  estimatedMinutes: number;
}

/**
 * Trigger dispatch: find nearby technicians and notify them.
 */
export async function triggerDispatch(
  job: DispatchJob,
): Promise<DispatchAttempt | null> {
  const io = getSocketServer();
  if (!io) {
    console.error('[Dispatch] Socket.IO not initialized');
    return null;
  }

  // Find top 3 nearby technicians from Redis cache
  const candidates = await findNearbyInCache(
    job.latitude,
    job.longitude,
    15, // 15km radius
    job.serviceType,
  );

  if (candidates.length === 0) {
    console.warn('[Dispatch] No technicians available');
    // Notify customer of no availability
    io.to(`user:${job.customerId}`).emit('dispatch:unavailable', {
      requestId: job.requestId,
      message: 'No technicians available in your area',
    });
    return null;
  }

  // Start with first candidate
  const firstCandidate = candidates[0];
  const attempt = await prisma.dispatchAttempt.create({
    data: {
      requestId: job.requestId,
      technicianId: firstCandidate.userId,
      radiusKm: 15,
      distanceKm: firstCandidate.distanceKm,
      estimatedMinutes: firstCandidate.estimatedMinutes,
      status: 'NOTIFIED',
    },
  });

  // Notify technician via Socket.IO
  io.to(`tech:${firstCandidate.userId}`).emit('dispatch:new', {
    dispatchId: attempt.id,
    requestId: job.requestId,
    latitude: job.latitude,
    longitude: job.longitude,
    serviceType: job.serviceType,
    estimatedPrice: job.estimatedPrice,
    distanceKm: firstCandidate.distanceKm,
    estimatedMinutes: firstCandidate.estimatedMinutes,
    customerName: 'Customer', // fetch from DB if needed
    description: job.description,
  });

  console.log(`[Dispatch] Notified ${firstCandidate.name} (${firstCandidate.distanceKm}km away)`);

  // Set timeout: if not accepted in 30s, try next technician
  setTimeout(() => escalateDispatch(job.requestId), DISPATCH_TIMEOUT_SECONDS * 1000);

  return attempt;
}

/**
 * Escalate to next technician if current one didn't respond.
 */
export async function escalateDispatch(requestId: string): Promise<void> {
  const io = getSocketServer();
  if (!io) return;

  const lastAttempt = await prisma.dispatchAttempt.findFirst({
    where: { requestId, status: 'NOTIFIED' },
    orderBy: { notifiedAt: 'desc' },
  });

  if (!lastAttempt) return; // Already handled

  // Mark as expired
  await prisma.dispatchAttempt.update({
    where: { id: lastAttempt.id },
    data: { status: 'EXPIRED' },
  });

  console.log(`[Dispatch] Escalating (attempt #${lastAttempt.id} expired)`);

  // Check if we've hit max attempts
  const attemptCount = await prisma.dispatchAttempt.count({
    where: { requestId, status: { in: ['ACCEPTED', 'DECLINED', 'EXPIRED'] } },
  });

  if (attemptCount >= MAX_DISPATCH_ATTEMPTS) {
    console.warn(`[Dispatch] Max attempts reached for request ${requestId}`);
    io.to(`request:${requestId}`).emit('dispatch:unavailable', {
      requestId,
      message: 'No technicians available. Please try again later.',
    });
    return;
  }

  // Find next technician (skip rejected ones)
  const rejectedTechIds = await prisma.dispatchAttempt
    .findMany({
      where: { requestId, status: 'DECLINED' },
      select: { technicianId: true },
    })
    .then((attempts) => attempts.map((a) => a.technicianId));

  const request = await prisma.serviceRequest.findUnique({
    where: { id: requestId },
  });
  if (!request) return;

  const candidates = await findNearbyInCache(
    request.latitude,
    request.longitude,
    15,
    request.serviceType,
  );

  const nextCandidate = candidates.find(
    (c) => !rejectedTechIds.includes(c.userId),
  );

  if (!nextCandidate) {
    io.to(`request:${requestId}`).emit('dispatch:unavailable', {
      requestId,
      message: 'No more technicians available.',
    });
    return;
  }

  // Create new attempt with next candidate
  const nextAttempt = await prisma.dispatchAttempt.create({
    data: {
      requestId,
      technicianId: nextCandidate.userId,
      radiusKm: 15,
      distanceKm: nextCandidate.distanceKm,
      estimatedMinutes: nextCandidate.estimatedMinutes,
      status: 'NOTIFIED',
    },
  });

  io.to(`tech:${nextCandidate.userId}`).emit('dispatch:new', {
    dispatchId: nextAttempt.id,
    requestId,
    latitude: request.latitude,
    longitude: request.longitude,
    serviceType: request.serviceType,
    description: request.description,
  });

  // Escalate again if no response
  setTimeout(() => escalateDispatch(requestId), DISPATCH_TIMEOUT_SECONDS * 1000);
}

/**
 * Technician accepts dispatch.
 */
export async function acceptDispatch(dispatchId: string): Promise<boolean> {
  const io = getSocketServer();
  const attempt = await prisma.dispatchAttempt.update({
    where: { id: dispatchId },
    data: { status: 'ACCEPTED', respondedAt: new Date() },
    include: { request: true, technician: { include: { user: true } } },
  });

  // Assign request to this technician
  await prisma.serviceRequest.update({
    where: { id: attempt.requestId },
    data: { technicianId: attempt.technicianId, status: 'ACCEPTED', acceptedAt: new Date() },
  });

  // Notify customer
  io?.to(`request:${attempt.requestId}`).emit('dispatch:accepted', {
    technicianName: attempt.technician.user.name,
    technicianPhone: attempt.technician.user.phone,
    estimatedMinutes: attempt.estimatedMinutes,
  });

  console.log(`[Dispatch] Accepted by ${attempt.technician.user.name}`);
  return true;
}

/**
 * Technician declines dispatch.
 */
export async function declineDispatch(dispatchId: string): Promise<void> {
  const attempt = await prisma.dispatchAttempt.update({
    where: { id: dispatchId },
    data: { status: 'DECLINED', respondedAt: new Date() },
    include: { request: true },
  });

  console.log('[Dispatch] Declined, escalating...');
  await escalateDispatch(attempt.requestId);
}
