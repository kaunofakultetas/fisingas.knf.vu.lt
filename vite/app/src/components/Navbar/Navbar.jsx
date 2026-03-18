

import { Link } from "react-router-dom";
import { Button } from '@mui/material';



const Navbar = () => {

  return (
    <div className="h-[75px] border-b border-b-[rgb(231,228,228)] flex items-center text-sm text-white bg-[rgb(123,0,63)] relative w-full">
      <Link to="/" style={{ textDecoration: "none", marginLeft: 30, marginRight: 30 }}>
        <div>
          <img src='/img/vulogo.png' alt="avatar" />
        </div>
      </Link>
      <div className="w-full p-5 flex items-center justify-between">

        <div>
          <Link to="/" style={{ textDecoration: "none" }}>
            <div style={{borderStyle: 'solid', borderWidth: 1, borderRadius: 15, color: 'white', borderColor: 'white', padding: 8, paddingLeft: 12, paddingRight: 12}}>
              Fišingo atakų atpažinimo testas
            </div>
          </Link>
        </div>

        <div className="flex items-center">
          <Button
            variant="contained"
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
