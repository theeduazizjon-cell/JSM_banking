import React from 'react'

const HeaderBox = ({ type= "title", title= "Welcome", user= "Guest", subtext= "Access and manage your account and transactions efficiently." }: HeaderBoxProps) => {
  return (
    <div className="header-box">
      <div className="header-box-content">
        <h1 className="header-box-title">
            {title}
            {type === "greeting" &&  (
                <span className="text-bankGradient">
                    &nbsp;{user}
                </span>
            )}
            </h1>
        <p className="header-box-subtext">{subtext}</p>
      </div>
    </div>
  )
}

export default HeaderBox