/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo } from 'react';
import API from '../config/API';
import useAsync from '../hooks/useAsync';

const CategoriesContext = createContext({ categories: [], loading: true, error: null, reload: () => {}, byId: () => null, bySlug: () => null });

export function CategoriesProvider({ children }) {
  const { data, error, loading, reload } = useAsync(() => API.get('/category').then((r) => r.data), []);
  const value = useMemo(() => {
    const categories = data || [];
    return {
      categories, loading, error, reload,
      byId: (id) => categories.find((c) => c._id === id) || null,
      bySlug: (slug) => categories.find((c) => c.slug === slug) || null,
    };
  }, [data, error, loading, reload]);
  return <CategoriesContext.Provider value={value}>{children}</CategoriesContext.Provider>;
}

export const useCategories = () => useContext(CategoriesContext);
