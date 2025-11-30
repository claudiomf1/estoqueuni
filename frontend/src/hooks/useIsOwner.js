import { useContext, useMemo } from 'react';
import { AuthContext } from '../context/AuthContext';

const normalize = (value) =>
  typeof value === 'string' ? value.trim().toLowerCase() : '';

export const useIsOwner = () => {
  const { nivelAcesso } = useContext(AuthContext);

  return useMemo(() => {
    const normalizedNivel = normalize(nivelAcesso);
    if (normalizedNivel === 'owner') return true;

    return false;
  }, [nivelAcesso]);
};

export default useIsOwner;



