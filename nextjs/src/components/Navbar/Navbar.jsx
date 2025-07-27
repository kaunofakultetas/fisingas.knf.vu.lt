'use client'
import { useRouter } from 'next/router';
import styles from './navbar.module.scss';
import Link from "next/link";
import { Button, Checkbox } from '@mui/material';



const Navbar = () => {

  return (
    <div className={styles.navbar}>
      <Link href="/" style={{ textDecoration: "none", marginLeft: 30, marginRight: 30 }}>
        <div>
          <img src='/img/vulogo.png' alt="avatar" />
        </div>
      </Link>
      <div className={styles.wrapper}>

        <div className={styles.search}>
          
          <Link href="/" style={{ textDecoration: "none" }}>
            <div style={{borderStyle: 'solid', borderWidth: 1, borderRadius: 15, color: 'white', borderColor: 'white', padding: 8, paddingLeft: 12, paddingRight: 12}}>
              Fišingo atakų atpažinimo testas
            </div>
          </Link>
        </div>

        <div className={styles.items}>
          
          <div className={styles.item}>
            {/* <DarkModeOutlinedIcon
              className="icon"
              onClick={() => dispatch({ type: "TOGGLE" })}
            /> */}
          </div>

          {/* <div className="item">
            <ListOutlinedIcon className="icon" />
          </div> */}

          {/* <Link href="/myprofile" style={{ textDecoration: "none" }}>
            <div className={styles.item}> */}
              {/* <div className="avatar-name-surname">Tomas Vanagas</div> */}
              {/* <img src="/img/avatar.png" alt="" className={styles.avatar} />
            </div>
          </Link> */}

          <Button
            variant="contained"
            // color="primary"
            style={{ background: 'rgb(123, 0, 63)', width: "100%", border: '1px solid rgba(255, 255, 255, 1)' }}
            onClick={() => { window.location.href = "/login" }}
          >
            Atsijungti
          </Button>

        </div>
      </div>
    </div>
  );
};

export default Navbar;
