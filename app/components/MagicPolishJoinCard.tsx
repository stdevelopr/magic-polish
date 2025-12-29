import styles from './MagicPolishJoinCard.module.css';

export default function MagicPolishJoinCard() {
  return (
    <section className={styles.card} aria-label="Join class">
      <div>
        <span className={styles.badge}>Live now</span>
        <h1 className={styles.title}>Join your Magic Polish class</h1>
        <p className={styles.subtitle}>
          Step into a calm space to practice Polish together. No accounts, no setup, just join and
          start learning.
        </p>
      </div>
      <div className={styles.joinArea}>
        <a className={styles.primaryButton} href="/room/demo">Join now</a>
      </div>
    </section>
  );
}
