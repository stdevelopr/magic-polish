import styles from './page.module.css';
import MagicPolishHeader from './shared-components/MagicPolishHeader/MagicPolishHeader';
import MagicPolishStats from './shared-components/MagicPolishStats/MagicPolishStats';
import MagicPolishDashboard from './shared-components/MagicPolishDashboard/MagicPolishDashboard';

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
