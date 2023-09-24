import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import React from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';

dayjs.extend(utc);
dayjs.extend(timezone);

createRoot(document.getElementById('root') || document.body).render(<App />);
