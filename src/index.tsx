import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

createRoot(document.getElementById('root') || document.body).render(<App />);
