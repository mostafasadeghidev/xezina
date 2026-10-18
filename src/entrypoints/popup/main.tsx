import { createRoot } from 'react-dom/client';
import '../../ui/styles.css';
import { PopupApp } from '../../ui/views/Popup';

createRoot(document.getElementById('root')!).render(<PopupApp />);
