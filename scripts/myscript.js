
var obox1 = document.createElement("div")
obox1.innerHTML = '<img src = "/img/movie.jpeg" width = "275" height = "370" />';
obox1.style.position = "fixed";
obox1.style.right = "20px";
obox1.style.bottom = "0px";
obox1.style.display = "none";

obox1.setAttribute("class", "movie")

var sbox = document.getElementsByTagName("body")[0];
sbox.appendChild(obox1);

