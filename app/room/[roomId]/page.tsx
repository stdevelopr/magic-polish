import RoomView from "./room-view/room-view.component";
import styles from "./page.module.css";

type RoomPageProps = {
  params: { roomId: string };
};

export default function RoomPage({ params }: RoomPageProps) {
  return (
    <main className={styles.roomPage}>
      <RoomView roomId={params.roomId} />
    </main>
  );
}
