import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSesion } from './contexto';

export function useEquipos() {
  const { repos } = useSesion();
  return useQuery({ queryKey: ['equipos'], queryFn: () => repos.equipos.listar() });
}
export function usePerfiles() {
  const { repos } = useSesion();
  return useQuery({ queryKey: ['perfiles'], queryFn: () => repos.perfiles.listar() });
}
export function useParametros() {
  const { repos } = useSesion();
  return useQuery({ queryKey: ['parametros'], queryFn: () => repos.parametros.obtener() });
}
export function useBkls() {
  const { repos } = useSesion();
  return useQuery({ queryKey: ['bkls'], queryFn: () => repos.bkls.listar() });
}
export function useBkl(numero: number) {
  const { repos } = useSesion();
  return useQuery({ queryKey: ['bkl', numero], queryFn: () => repos.bkls.obtener(numero) });
}
export function useEventos(numero: number) {
  const { repos } = useSesion();
  return useQuery({ queryKey: ['eventos', numero], queryFn: () => repos.bkls.eventos(numero) });
}

/** Mutación que al terminar refresca BKL, equipos y parámetros. */
export function useAccion<T, R = unknown>(fn: (x: T) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bkls'] });
      qc.invalidateQueries({ queryKey: ['bkl'] });
      qc.invalidateQueries({ queryKey: ['eventos'] });
      qc.invalidateQueries({ queryKey: ['equipos'] });
      qc.invalidateQueries({ queryKey: ['parametros'] });
    },
  });
}
