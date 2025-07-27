import styles from './BouncingDotsLoader.module.css';


const BouncingDotsLoader = () => {
  return (
    <div className={styles.bouncingLoader}>
      <div className={styles.bouncingLoaderDiv}></div>
      <div className={styles.bouncingLoaderDiv2}></div>
      <div className={styles.bouncingLoaderDiv3}></div>
    </div>
  );
};

export default BouncingDotsLoader;
