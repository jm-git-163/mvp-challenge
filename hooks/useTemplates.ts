import { useState, useEffect, useCallback } from 'react';
import { fetchTemplates, fetchTemplateById } from '../services/supabase';
import type { Template } from '../types/template';

interface UseTemplatesOptions {
  genre?: Template['genre'];
  difficulty?: Template['difficulty'];
}

interface UseTemplatesReturn {
  templates: Template[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/** 템플릿 목록을 Supabase에서 불러오는 커스텀 훅 */
export function useTemplates(options?: UseTemplatesOptions): UseTemplatesReturn {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchTemplates(options);
      setTemplates(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : '템플릿 로드 실패');
    } finally {
      setLoading(false);
    }
  }, [options?.genre, options?.difficulty]);

  useEffect(() => { load(); }, [load]);

  return { templates, loading, error, refetch: load };
}

interface UseTemplateDetailReturn {
  template: Template | null;
  loading: boolean;
  error: string | null;
}

/** 단일 템플릿 상세 정보 훅 */
export function useTemplateDetail(id: string | null): UseTemplateDetailReturn {
  const [template, setTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchTemplateById(id);
        if (!cancelled) setTemplate(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '로드 실패');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [id]);

  return { template, loading, error };
}
