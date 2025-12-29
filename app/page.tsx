import styles from './page.module.css';
import MagicPolishHeader from './components/MagicPolishHeader';
import MagicPolishStats from './components/MagicPolishStats';
import MagicPolishDashboard from './components/MagicPolishDashboard';

export default function HomePage() {
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <MagicPolishHeader />
        <MagicPolishStats />
        <MagicPolishDashboard />
      </div>
    </main>
  );
}
