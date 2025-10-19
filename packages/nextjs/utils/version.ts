// Auto-generated build timestamp
// This file is committed to git and captures the build time
const buildDate = new Date();
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const month = months[buildDate.getMonth()];
const day = buildDate.getDate();
const hours = buildDate.getHours().toString().padStart(2, "0");
const minutes = buildDate.getMinutes().toString().padStart(2, "0");

export const BUILD_VERSION = `${month} ${day}, ${hours}:${minutes}`;
