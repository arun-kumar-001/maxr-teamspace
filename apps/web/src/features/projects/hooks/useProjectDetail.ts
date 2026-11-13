import { useCallback, useEffect, useState } from 'react';
import {
  addProjectMember,
  createProjectMilestone,
  createProjectUpdate,
  deleteProjectDocument,
  fetchProjectById,
  fetchProjectDocumentDownloadLink,
  ProjectsApiError,
  removeProjectMember,
  updateProject,
  updateProjectMilestone,
  uploadProjectDocument,
} from '../api/projectsApi';
import type {
  CreateMilestoneInput,
  CreateProjectUpdateInput,
  ProjectDetail,
  ProjectDocumentCategory,
  UpdateMilestoneInput,
  UpdateProjectInput,
} from '../types';

export function useProjectDetail(projectId?: string) {
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(projectId));
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | undefined>(undefined);
  const [statusCode, setStatusCode] = useState<number | undefined>(undefined);

  const loadProject = useCallback(
    async (signal?: AbortSignal) => {
      if (!projectId) {
        setProject(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      setErrorCode(undefined);
      setStatusCode(undefined);

      try {
        const detail = await fetchProjectById(projectId, signal);
        setProject(detail);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        if (err instanceof ProjectsApiError) {
          setError(err.message);
          setErrorCode(err.code);
          setStatusCode(err.status);
        } else if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('Failed to fetch project details');
        }
      } finally {
        setLoading(false);
      }
    },
    [projectId],
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadProject(controller.signal);
    return () => controller.abort();
  }, [loadProject]);

  const handleUpdate = async (
    input: Omit<UpdateProjectInput, 'version'>,
  ): Promise<ProjectDetail> => {
    if (!project) throw new Error('No project loaded');
    const updated = await updateProject(project.id, {
      ...input,
      version: project.version,
    });
    setProject(updated);
    return updated;
  };

  const handleToggleArchive = async (): Promise<ProjectDetail> => {
    if (!project) throw new Error('No project loaded');
    const targetStatus = project.status === 'active' ? 'archived' : 'active';
    return handleUpdate({ status: targetStatus });
  };

  const handleAddMember = async (employeeId: string): Promise<ProjectDetail> => {
    if (!project) throw new Error('No project loaded');
    const updated = await addProjectMember(project.id, employeeId);
    setProject(updated);
    return updated;
  };

  const handleRemoveMember = async (employeeId: string): Promise<ProjectDetail> => {
    if (!project) throw new Error('No project loaded');
    const updated = await removeProjectMember(project.id, employeeId);
    setProject(updated);
    return updated;
  };

  const handleAddMilestone = async (input: CreateMilestoneInput) => {
    if (!project) throw new Error('No project loaded');
    await createProjectMilestone(project.id, input);
    await loadProject();
  };

  const handleUpdateMilestone = async (milestoneId: string, input: UpdateMilestoneInput) => {
    if (!project) throw new Error('No project loaded');
    await updateProjectMilestone(project.id, milestoneId, input);
    await loadProject();
  };

  const handlePostUpdate = async (input: CreateProjectUpdateInput) => {
    if (!project) throw new Error('No project loaded');
    await createProjectUpdate(project.id, input);
    await loadProject();
  };

  const handleUploadDocument = async (
    file: File,
    category: ProjectDocumentCategory = 'general',
  ) => {
    if (!project) throw new Error('No project loaded');
    await uploadProjectDocument(project.id, file, category);
    await loadProject();
  };

  const handleDownloadDocument = async (documentId: string) => {
    if (!project) throw new Error('No project loaded');
    const link = await fetchProjectDocumentDownloadLink(project.id, documentId);
    window.open(link.url, '_blank', 'noopener,noreferrer');
  };

  const handleDeleteDocument = async (documentId: string) => {
    if (!project) throw new Error('No project loaded');
    await deleteProjectDocument(project.id, documentId);
    await loadProject();
  };

  return {
    project,
    loading,
    error,
    errorCode,
    statusCode,
    refetch: loadProject,
    updateProject: handleUpdate,
    toggleArchive: handleToggleArchive,
    addMember: handleAddMember,
    removeMember: handleRemoveMember,
    addMilestone: handleAddMilestone,
    updateMilestone: handleUpdateMilestone,
    postUpdate: handlePostUpdate,
    uploadDocument: handleUploadDocument,
    downloadDocument: handleDownloadDocument,
    deleteDocument: handleDeleteDocument,
  };
}
