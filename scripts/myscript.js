
var obox1 = document.createElement("div")
obox1.innerHTML = '<img src = "/img/movie.jpeg" width = "275" height = "370" />';
obox1.style.position = "fixed";
obox1.style.right = "20px";
obox1.style.bottom = "0px";

var htmlstr = '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"></script><ins class="adsbygoogle" style="display:block; text-align:center;" data-ad-layout="in-article" data-ad-format="fluid" data-ad-client="ca-pub-8828078415045620" data-ad-slot="7586680510"></ins><script>(adsbygoogle = window.adsbygoogle || []).push({});</script>'
var obox2 = document.createElement("div")
obox2.innerHTML = htmlstr;

var sbox = document.getElementsByTagName("body")[0];
sbox.appendChild(obox1);

var p = document.getElementsByTagName("section")[0];
var sbox2 = document.getElementsByTagName("h3")[0];
p.insertBefore(obox2, sbox2);
