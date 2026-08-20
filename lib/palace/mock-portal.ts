export type ReviewStatus = 'pending' | 'approved' | 'declined'

export type Student = {
  id: string
  studentNumber: string
  firstName: string
  lastName: string
  email: string
  nationalIdNumber: string
  photoName: string
  photoCapturedAt: string
  photoFresh: boolean
  status: ReviewStatus
  password: string
  results: { subject: string; mark: number; grade: string; term: string }[]
}

const seed: Student[] = [{
  id: 'stu_202434357', studentNumber: '202434357', firstName: 'Nandi', lastName: 'Dlamini', email: 'nandi@example.edu', nationalIdNumber: '4406056400016', photoName: 'nandi-id.jpg', photoCapturedAt: new Date().toISOString(), photoFresh: true, status: 'pending', password: 'Student123!',
  results: [{ subject: 'Mathematics', mark: 86, grade: 'A', term: 'Term 2 2026' }, { subject: 'Computer Science', mark: 78, grade: 'B+', term: 'Term 2 2026' }, { subject: 'English', mark: 91, grade: 'A+', term: 'Term 2 2026' }],
}]

const key = 'student-palace-preview-db'
export function getStudents(): Student[] { if (typeof window === 'undefined') return seed; const saved = window.localStorage.getItem(key); return saved ? JSON.parse(saved) : seed }
export function saveStudents(students: Student[]) { window.localStorage.setItem(key, JSON.stringify(students)) }
export function photoAgeDays(lastModified: number) { return Math.max(0, Math.floor((Date.now() - lastModified) / 86400000)) }
export function matchesStudent(student: Student, value: string) { return [student.studentNumber, student.email, student.nationalIdNumber].some((item) => item.toLowerCase() === value.trim().toLowerCase()) }
