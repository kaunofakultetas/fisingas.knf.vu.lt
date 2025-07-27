import Link from "next/link";
import ArrowUpwardSharpIcon from '@mui/icons-material/ArrowUpwardSharp';
import ArrowDownwardSharpIcon from '@mui/icons-material/ArrowDownwardSharp';


const Widget = ({ text, bottomtext, count, icon, link, difference, children }) => {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      flex: 1,
      padding: '10px',
      boxShadow: '2px 4px 10px 1px rgba(201, 201, 201, 0.47)',
      borderRadius: '15px',
      height: '100px',
      width: '100%',
      backgroundColor: 'white'
    }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between'
      }}>
        <span style={{
          fontWeight: 'bold',
          fontSize: '14px',
          color: 'rgb(160, 160, 160)'
        }}>{text}</span>
        <span style={{
          fontSize: '28px',
          fontWeight: 300
        }}>{count}</span>
        <span style={{
          width: 'max-content',
          fontSize: '12px',
          borderBottom: '1px solid gray'
        }}>{bottomtext}</span>
      </div>

      <div style={{ marginLeft: 'auto' }}>
        {children}
      </div>

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        marginRight: '10px'
      }}>
        <div style={{display: 'flex'}}>
          {(difference > 0 &&
            <div style={{
              display: 'flex',
              alignItems: 'center',
              fontSize: '18px',
              borderRadius: '5px',
              color: 'white',
              backgroundColor: 'green',
              padding: '3px',
              paddingRight: '5px',
              marginLeft: '20px'
            }}>
              <ArrowUpwardSharpIcon />
              {difference}
            </div>
          ) || (difference < 0 &&
            <div style={{
              display: 'flex',
              alignItems: 'center',
              fontSize: '18px',
              borderRadius: '5px',
              color: 'white',
              backgroundColor: 'red',
              padding: '3px',
              paddingRight: '5px',
              marginLeft: '20px'
            }}>
              <ArrowDownwardSharpIcon />
              {difference}
            </div>
          ) || (
            <div style={{ marginLeft: '80px' }}></div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          {link ?
            <Link href={link} style={{ textDecoration: "none", margin: 0, padding: 0 }}>
              <>{icon}</>
            </Link>
            :
            <div style={{ alignSelf: 'end' }}>
              <>{icon}</>
            </div>
          }
        </div>
      </div>
    </div>
  );
};

export default Widget;
