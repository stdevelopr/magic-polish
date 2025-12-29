import MagicPolishJoinCard from './MagicPolishJoinCard';
import styles from './MagicPolishDashboard.module.css';

export default function MagicPolishDashboard() {
  return (
    <section className={styles.dashboard} aria-label="Classroom dashboard">
      <MagicPolishJoinCard />
    </section>
  );
}
