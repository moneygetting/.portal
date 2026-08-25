import { storage } from "./firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";

/**
 * Uploads an image file to Firebase Storage
 * @param {File} file - The file object from <input type="file" />
 * @param {string} userId - The authenticated user's ID
 * @param {function} onProgress - Callback for upload progress percentage
 * @returns {Promise<string>} The public download URL of the uploaded image
 */
export const uploadImageToStorage = (file, userId, onProgress) => {
  return new Promise((resolve, reject) => {
    if (!file) return reject("No file provided");

    // Generate a unique filename using timestamp
    const fileExtension = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExtension}`;
    
    // Create a storage reference
    const storageRef = ref(storage, `images/${userId}/${fileName}`);

    // Start upload task
    const uploadTask = uploadBytesResumable(storageRef, file, {
      contentType: file.type,
    });

    // Listen to state changes, errors, and completion
    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        if (onProgress) onProgress(Math.round(progress));
      },
      (error) => {
        console.error("Firebase upload error:", error);
        reject(error);
      },
      async () => {
        // Upload completed successfully, fetch download URL
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(downloadURL);
        } catch (err) {
          reject(err);
        }
      }
    );
  });
};