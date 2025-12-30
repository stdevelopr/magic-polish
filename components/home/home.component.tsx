import MagicPolishHeader from "./MagicPolishHeader/MagicPolishHeader";
import MagicPolishStats from "./MagicPolishStats/MagicPolishStats";
import MagicPolishDashboard from "./MagicPolishDashboard/MagicPolishDashboard";
import styles from "./home.module.css";

export default function Home() {
  return (
    <main className={styles.home}>
      <div className={styles.homeShell}>
        <MagicPolishHeader />
        <MagicPolishStats />
        <MagicPolishDashboard />
      </div>
    </main>
  );
}
