
var obox = document.createElement("div")
obox.innerHTML = '<a href="https://u.jd.com/Uj4bve" target="_blank" title="ElasticSearch源码解析与优化实践">' + 
                    '<img src = "/img/elasticsearch.jpg" width = "200" height = "200" />' +
                    '</a>';
obox.style.position = "fixed";
obox.style.right = "20px";
obox.style.bottom = "100px";

var sbox = document.getElementsByTagName("body")[0];
sbox.appendChild(obox);

var scbox1 = document.createElement("script")
scbox1.type = "text/javascript"
scbox1.innerHTML = 'var jd_union_pid = "3002597012";var jd_union_euid = "";'
var scbox2 = document.createElement("script")
scbox2.type = "text/javascript"
scbox2.src = "//ads-union.jd.com/static/js/union.js"

sbox.appendChild(scbox1)
sbox.appendChild(scbox2)