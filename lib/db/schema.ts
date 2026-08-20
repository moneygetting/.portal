import { boolean, integer, pgTable, text, timestamp, uniqueIndex, varchar, index } from 'drizzle-orm/pg-core'

export const portalStudents = pgTable('portal_students', {
  id: text('id').primaryKey(),
  computerNumber: varchar('computer_number', { length: 10 }).notNull().unique(),
  studentNumber: text('student_number').notNull().unique(),
  email: text('email').notNull().unique(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  nationalId: text('national_id').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  status: text('status').notNull().default('pending'),
  academicLevel: integer('academic_level').notNull().default(1),
  academicYear: integer('academic_year').notNull(),
  semesterSignIns: integer('semester_sign_ins').notNull().default(0),
  lastSignInSemester: integer('last_sign_in_semester'),
  lastSignInAt: timestamp('last_sign_in_at', { withTimezone: true }),
  photoName: text('photo_name'),
  photoCapturedAt: timestamp('photo_captured_at', { withTimezone: true }),
  photoFresh: boolean('photo_fresh').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({ nationalIdLookup: uniqueIndex('portal_students_national_id_idx').on(table.nationalId) }))

export const portalResults = pgTable('portal_results', {
  id: text('id').primaryKey(),
  computerNumber: varchar('computer_number', { length: 10 }).notNull(),
  subject: text('subject').notNull(),
  mark: integer('mark').notNull(),
  grade: text('grade').notNull(),
  term: text('term').notNull(),
  fileName: text('file_name'),
  fileSize: integer('file_size'),
  uploadedBy: text('uploaded_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({ lookup: index('portal_results_computer_number_idx').on(table.computerNumber, table.createdAt) }))

export const portalEvents = pgTable('portal_events', {
  id: text('id').primaryKey(),
  computerNumber: varchar('computer_number', { length: 10 }),
  event: text('event').notNull(),
  semester: integer('semester'),
  academicYear: integer('academic_year'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({ lookup: index('portal_events_student_idx').on(table.computerNumber, table.createdAt) }))

export type PortalResult = typeof portalResults.$inferSelect
export type PortalStudent = typeof portalStudents.$inferSelect
export type PortalEvent = typeof portalEvents.$inferSelect
