
import Widget from "@/components/Admin/Widget/Widget";
import StudentProgress from "@/components/Admin/Widget/StudentProgress";
import AdminPageLayout from "@/systemPages/admin/AdminPageLayout";

import React from "react";
import axios from "axios";
import toast from 'react-hot-toast';
import { Box, Typography, TextField, MenuItem } from '@mui/material';
import useFetchData from "@/hooks/useFetchData";



import PeopleOutlinedIcon from '@mui/icons-material/PeopleOutlined';
import QuestionMarkOutlinedIcon from '@mui/icons-material/QuestionMarkOutlined';
import RecordVoiceOverIcon from '@mui/icons-material/RecordVoiceOver';
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined';
import DirectionsCarOutlinedIcon from '@mui/icons-material/DirectionsCarOutlined';
import ElectricBoltIcon from '@mui/icons-material/ElectricBolt';
import EngineeringIcon from '@mui/icons-material/Engineering';
import TerminalOutlinedIcon from '@mui/icons-material/TerminalOutlined';
import SchoolOutlinedIcon from '@mui/icons-material/SchoolOutlined';
import CastForEducationOutlinedIcon from '@mui/icons-material/CastForEducationOutlined';


const iconClass = "text-[18px] p-[5px] rounded-[5px] self-end text-white bg-[rgb(230,65,100)]";

const Home = () => {

  const { data, loadingData } = useFetchData("/api/admin/home", 2);

  const getIconFromName = (iconName) => {
    const icons = {
      PersonOutlinedIcon: PersonOutlinedIcon,
      QuestionMarkOutlinedIcon: QuestionMarkOutlinedIcon,
      CreditCardOutlinedIcon: CreditCardOutlinedIcon,
      DirectionsCarOutlinedIcon: DirectionsCarOutlinedIcon,
      PeopleOutlinedIcon: PeopleOutlinedIcon,
      RecordVoiceOverIcon: RecordVoiceOverIcon,
      ElectricBoltIcon: ElectricBoltIcon,
      EngineeringIcon: EngineeringIcon,
      TerminalOutlinedIcon: TerminalOutlinedIcon,
      SchoolOutlinedIcon: SchoolOutlinedIcon,
      CastForEducationOutlinedIcon: CastForEducationOutlinedIcon,
    };
    const Icon = icons[iconName] || CreditCardOutlinedIcon;
    return <Icon className={iconClass} />;
  }



  if (loadingData) {
    return <></>;
  }
  

  return (
    <AdminPageLayout backgroundColor="#EBECEF">
      <div className="flex flex-col pt-5 min-h-full">
        
        <div className="flex p-2.5 gap-2.5">
          <Widget 
            text="Studentų" 
            count={data.studentscount} 
            icon={getIconFromName("PeopleOutlinedIcon")} 
            link="/admin/students"
          />
          <Widget 
            text="Klausimai" 
            count={data.enabledquestionscount + "/" + data.totalquestionscount} 
            icon={getIconFromName("QuestionMarkOutlinedIcon")} 
            link="/admin/questions"
          >
            <Box 
              sx={{
                backgroundColor: 'lightgrey',
                borderRadius: 2,
                border: '1px solid black',
                p: 1.5,
                pl: 4,
                pr: 4,
              }}
            >
              <Typography 
                variant="caption" 
                color="black"
                sx={{ mb: 0.5, fontSize: '1em' }}
              >
                Testo dydis:
              </Typography>
              <TextField
                select
                fullWidth
                size="small"
                variant="outlined"
                defaultValue={data.phishingtestsize}
                onChange={(e) => {
                  axios.post("/api/admin/update/phishingtestsize", 
                    { phishingtestsize: e.target.value }, { withCredentials: true })
                    .then(() => {
                      toast.success(<b>Išsaugota</b>, { duration: 3000 });
                    });
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 1,
                    backgroundColor: 'white',
                  }
                }}
              >
                <MenuItem value="9">9</MenuItem>
                <MenuItem value="12">12</MenuItem>
                <MenuItem value="15">15</MenuItem>
                <MenuItem value="21">21</MenuItem>
                <MenuItem value="30">30</MenuItem>
              </TextField>
            </Box>
          </Widget>
        </div>
        <div className="flex p-2.5 gap-2.5">
          <StudentProgress text="Testą Sprendžia:" studentsprogress={data.studentsprogress}/>
        </div>

      </div>
    </AdminPageLayout>
  );
};

export default Home;
