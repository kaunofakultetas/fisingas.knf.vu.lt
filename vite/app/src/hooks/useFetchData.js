import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';



export default function useFetchData(endpoint, refreshInterval = null, allowEmpty = false) {
  const [data, setData] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoadingData(true);
  }, [endpoint]);

  const fetchData = useCallback(async () => {
    if (allowEmpty && !endpoint) {
      setLoadingData(false);
      return;
    }

    try {
      const response = await axios.get(endpoint, { withCredentials: true });
      setData(response.data);
      setLoadingData(false);
    } catch (err) {
      if (err.response?.status === 401) {
        window.location.href = '/login';
      } else {
        setError(err);
        setLoadingData(false);
      }
    }
  }, [endpoint]);

  useEffect(() => {
    fetchData();

    if (refreshInterval) {
      const interval = setInterval(fetchData, refreshInterval * 1000);
      return () => clearInterval(interval);
    }
  }, [fetchData, refreshInterval]);

  return { data, loadingData, error, refetch: fetchData };
}
