import styles from './MagicPolishHeader.module.css';

export default function MagicPolishHeader() {
  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <span className={styles.brandMark} aria-hidden="true" />
        <div>
          <p className={styles.brandTitle}>Magic Polish</p>
          <p className={styles.brandSubtitle}>A cozy dashboard for live classes</p>
        </div>
      </div>
    </header>
  );
}
