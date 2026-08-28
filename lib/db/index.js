import mongoose from 'mongoose'

const globalForMongo = globalThis

export async function connectDatabase() {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is required')
  }

  if (mongoose.connection.readyState === 1) {
    return mongoose.connection
  }

  if (!globalForMongo.mongoConnection) {
    globalForMongo.mongoConnection = mongoose.connect(process.env.MONGO_URI, {
      maxPoolSize: 20,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4,
    })
  }

  await globalForMongo.mongoConnection
  return mongoose.connection
}

const studentSchema = new mongoose.Schema({
  computerNumber: { type: String, required: true, unique: true, index: true },
  studentNumber: { type: String, required: true, unique: true, index: true },
  email: { type: String, required: true, unique: true, lowercase: true, index: true },
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  nationalId: { type: String, required: true, unique: true, index: true },
  passwordHash: { type: String, required: true },
  status: { type: String, enum: ['pending', 'approved', 'declined'], default: 'pending', index: true },
  selfieUrl: String,
  nationalIdUrl: String,
  photoCapturedAt: Date,
  photoFresh: { type: Boolean, default: false },
  mediaVerifiedAt: Date,
  academicLevel: { type: Number, default: 1 },
  academicYear: { type: Number, default: () => new Date().getUTCFullYear() },
  semesterSignIns: { type: Number, default: 0 },
  lastSignInSemester: Number,
  lastSignInAt: Date,
}, { timestamps: true, collection: 'portal_students' })

const resultSchema = new mongoose.Schema({
  computerNumber: { type: String, required: true, index: true },
  subject: { type: String, required: true, trim: true },
  mark: { type: Number, required: true, min: 0, max: 100 },
  grade: { type: String, required: true },
  term: { type: String, required: true, trim: true },
  fileName: String,
  fileSize: Number,
  fileUrl: String,
  uploadedBy: { type: String, required: true },
}, { timestamps: true, collection: 'portal_results' })
resultSchema.index({ computerNumber: 1, createdAt: -1 })

const eventSchema = new mongoose.Schema({
  computerNumber: String,
  event: { type: String, required: true },
  semester: Number,
  academicYear: Number,
}, { timestamps: { createdAt: true, updatedAt: false }, collection: 'portal_events' })
eventSchema.index({ computerNumber: 1, createdAt: -1 })

export const Student = mongoose.models.PortalStudent || mongoose.model('PortalStudent', studentSchema)
export const Result = mongoose.models.PortalResult || mongoose.model('PortalResult', resultSchema)
export const Event = mongoose.models.PortalEvent || mongoose.model('PortalEvent', eventSchema)
