import { useEffect } from 'react';
import { Can } from '../components/Can';
import { useAuth } from '../context/AuthContext';
import { useCan } from '../hooks/useCan';
import { setupAPIClient } from '../services/api';
import { api } from '../services/apiClient';
import styles from '../styles/Home.module.css';
import { withSSRAuth } from '../utils/withSSRAuth';

export default function Dashboard() {
  const { user, signOut } = useAuth();

  useEffect(() => {
    api
      .get('/me')
      .then((response) => console.log(response))
      .catch((error) => console.log(error));
  }, []);

  return (
    <div className={styles.container}>
      <h1>Dashboard: {user?.email}</h1>
      <button onClick={signOut}>Sign out</button>
      <Can permissions={['metrics.list']}>
        <div>Métricas</div>
      </Can>
    </div>
  );
}

export const getServerSideProps = withSSRAuth(async (ctx) => {
  const apiClient = setupAPIClient(ctx);

  const response = await apiClient.get('/me');

  return {
    props: {},
  };
});
