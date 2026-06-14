import { prisma } from '@/config/database';
import { AttendanceLog } from '@prisma/client';

export class AttendanceLogRepository {
  async create(data: {
    eventId: string;
    guestId: string;
    checkedInBy?: string;
    method?: string;
    notes?: string;
  }): Promise<AttendanceLog> {
    return prisma.attendanceLog.create({
      data,
      include: { guest: { select: { fullName: true, phone: true } } },
    });
  }

  async findByEvent(eventId: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      prisma.attendanceLog.findMany({
        where: { eventId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { guest: { select: { fullName: true } }, staffMember: { select: { firstName: true, lastName: true } } },
      }),
      prisma.attendanceLog.count({ where: { eventId } }),
    ]);
    return { data, total, page, limit };
  }

  async hasCheckedIn(guestId: string, eventId: string): Promise<boolean> {
    const count = await prisma.attendanceLog.count({ where: { guestId, eventId } });
    return count > 0;
  }
}
