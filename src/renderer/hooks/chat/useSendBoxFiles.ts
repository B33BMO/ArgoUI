import { useCallback } from 'react';
import type { FileMetadata } from '@/renderer/services/FileService';
import { getCleanFileNames } from '@/renderer/services/FileService';
import type { FileOrFolderItem } from '@/renderer/utils/file/fileTypes';

/**
 * setUploadFile
 */
export const createSetUploadFile = (
  mutate: (fn: (prev: Record<string, unknown> | undefined) => Record<string, unknown>) => void,
  data: unknown
) => {
  return useCallback(
    (uploadFile: string[] | ((prev: string[]) => string[])) => {
      mutate((prev) => {
        // Derive latest upload list to keep functional updates accurate
        const previousUploadFile = Array.isArray(prev?.uploadFile) ? (prev?.uploadFile as string[]) : [];
        const newUploadFile = typeof uploadFile === 'function' ? uploadFile(previousUploadFile) : uploadFile;
        return { ...prev, uploadFile: newUploadFile };
      });
    },
    [data, mutate]
  );
};

const formatFileRef = (fileName: string): string => {
  const trimmed = fileName.trim();
  // Remove @ prefix if present (normalize)
  // @ prefix is an internal implementation detail for ACP agents
  // It will be added by the backend when needed
  // @ ACP agent
  const normalized = trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
  return normalized;
};

interface UseSendBoxFilesProps {
  atPath: Array<string | FileOrFolderItem>;
  uploadFile: string[];
  setAtPath: (atPath: Array<string | FileOrFolderItem>) => void;
  setUploadFile: (uploadFile: string[] | ((prev: string[]) => string[])) => void;
}

/**
 * Note: files can be full paths, getCleanFileNames will extract filenames
 */
export const formatFilesForMessage = (files: string[]): string => {
  if (files.length > 0) {
    return getCleanFileNames(files)
      .map((v) => formatFileRef(v))
      .join(' ');
  }
  return '';
};

/**
 */
export const useSendBoxFiles = ({ atPath, uploadFile, setAtPath, setUploadFile }: UseSendBoxFilesProps) => {
  const handleFilesAdded = useCallback(
    (files: FileMetadata[]) => {
      const filePaths = files.map((file) => file.path);
      setUploadFile((prevUploadFile) => [...prevUploadFile, ...filePaths]);
    },
    [setUploadFile]
  );

  // Process file references in messages (format: @filename)
  const processMessageWithFiles = useCallback(
    (message: string): string => {
      if (atPath.length || uploadFile.length) {
        const cleanUploadFiles = getCleanFileNames(uploadFile).map((fileName) => formatFileRef(fileName));
        // atPath may now contain string paths or objects, need to handle separately
        const atPathStrings = atPath.map((item) => {
          if (typeof item === 'string') {
            return item;
          } else {
            return item.path;
          }
        });
        const cleanAtPaths = getCleanFileNames(atPathStrings).map((fileName) => formatFileRef(fileName));
        return cleanUploadFiles.join(' ') + ' ' + cleanAtPaths.join(' ') + ' ' + message;
      }
      return message;
    },
    [atPath, uploadFile]
  );

  const clearFiles = useCallback(() => {
    setAtPath([]);
    setUploadFile([]);
  }, [setAtPath, setUploadFile]);

  return {
    handleFilesAdded,
    processMessageWithFiles,
    clearFiles,
  };
};
