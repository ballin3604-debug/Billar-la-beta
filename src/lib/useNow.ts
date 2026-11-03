import { useEffect, useState } from 'react';

/**
 * Reloj que sigue la hora del servidor local. Se usa para cronómetros de mesas
 * y para que todos los equipos conectados vean la misma duración.
 */
export function useNow(offsetMs = 0, intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now() + offsetMs);

  useEffect(() => {
    setNow(Date.now() + offsetMs);
    const timer = window.setInterval(() => setNow(Date.now() + offsetMs), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs, offsetMs]);

  return now;
}
