import React from "react";
import { supabase } from "./createClient";

const App1 = () => {
  return <div>Welcome to Beehive!</div>;

  async function fetchUsers(){
    const {dataaa} = supabase
    .from('users')
    .select('*');
    console.log(dataaa);
  }

  return(
    <div>bottom</div>
  )
} 

export default App1;