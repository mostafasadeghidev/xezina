import { createRoot } from 'react-dom/client';
import '../../ui/styles.css';
import { NewTabApp } from '../../ui/views/NewTab';

createRoot(document.getElementById('root')!).render(<NewTabApp />);
