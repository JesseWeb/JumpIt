const ImageParser = require("image-parser");
const childProcess = require('child_process')
const execSync = childProcess.execSync
const exec = childProcess.exec
const execFile = childProcess.execFile
const fs = require('fs')
let under_game_score_y
let press_coefficient
let piece_base_height_1_2
let piece_body_width
let config = open_accordant_config()
under_game_score_y = config['under_game_score_y']
press_coefficient = config['press_coefficient'] //# 长按的时间系数，请自己根据实际情况调节
piece_base_height_1_2 = config['piece_base_height_1_2'] //# 二分之一的棋子底座高度，可能要调节
piece_body_width = config['piece_body_width'] //# 棋子的宽度，比截图中量到的稍微大一点比较安全，可能要调节

let n = 0,
    next_rest = randomFrom(3, 10)
next_rest_time = randomFrom(5, 10);

let swipe_x1, swipe_y1, swipe_x2, swipe_y2

let screenshot_way = 2

function open_accordant_config() {
    // '''
    // 调用配置文件
    // '''
    let screen_size = _get_screen_size()
    let config_file = `${__dirname}/config/${screen_size}/config.json`
    let json = {}
    if (fs.existsSync(config_file)) {
        json = fs.readFileSync(config_file, {
            encoding: "utf-8"
        })
    } else {
        json = fs.readFileSync(`./config/default.json`, {
            encoding: "utf-8"
        })
    }
    return JSON.parse(json)
}

function abs(number) {
    return Math.abs(number)
}

function len(array) {
    return array.length
}

function _get_screen_size() {
    let str = execSync('adb shell wm size', {
        encoding: "utf8"
    })
    let position = str.search(/(\d+)x(\d+)/)
    if (position) {
        return str.substr(position).replace(/\r/g, '').replace(/\n/g, '')
    } else {
        return '1920x1080'
    }
}
function int(num) {
    return Number(num.toFixed(0))
}
function randomFrom(lowerValue, upperValue, notFixed) {
    if (notFixed) {
        return Math.random() * (upperValue - lowerValue + 1) + lowerValue
    }
    return Math.floor(Math.random() * (upperValue - lowerValue + 1) + lowerValue);
}
class Autojumping {
    constructor() {
        this.returnImageData()
    }
    pull_screenshot() {
        execSync('adb shell screencap -p /sdcard/autojump.png')
        execSync('adb pull /sdcard/autojump.png .')
    }
    getImageData(path) {
        return new Promise((resolve, reject) => {
            let img = new ImageParser(path)
            img.parse((err) => {
                if (err) {
                    return console.error(err);
                }
                resolve({
                    img: img,
                    size: {
                        w: img.width(),
                        h: img.height()
                    }
                })
            })
        })
    }
    jump(distance) {
        let press_time = distance * press_coefficient
        press_time = press_time > 200 ? press_time : 200
        press_time = int(press_time)
        let cmd = `adb shell input swipe ${swipe_x1} ${swipe_y1} ${swipe_x2} ${swipe_y2} ` + String(press_time)
        console.log(cmd)
        execSync(cmd)
    }
    keepGoing() {
        new Autojumping()
    }

    set_button_position(im) {
        // '''
        // 将 swipe 设置为 `再来一局` 按钮的位置
        // '''
        // global swipe_x1, swipe_y1, swipe_x2, swipe_y2
        let w = Number(im.size.w)
        let h = Number(im.size.h)
        let left = int(w / 2)
        let top = int(1584 * (h / 1920.0))
        left = int(randomFrom(Number(left) - 50, Number(left) + 50))
        top = int(randomFrom(Number(top) - 10, Number(top) + 10)) //# 随机防 ban
        swipe_x1 = left
        swipe_y1 = top
        swipe_x2 = left
        swipe_y2 = top
    }
    returnImageData() {
        this.pull_screenshot()
        this.getImageData('autojump.png').then((value) => {
            let {
                piece_x,
                piece_y,
                board_x,
                board_y
            } = this.find_piece_and_board(value)
            let ts = new Date().getTime()
            this.set_button_position(value)
            this.jump(Math.sqrt((board_x - piece_x) ** 2 + (board_y - piece_y) ** 2))
            n += 1
            if (n == next_rest) {
                console.log(`已经连续打了${n}下,休息${next_rest_time}s`)
                let x = next_rest_time
                let timer = setInterval(() => {
                    x--
                    if (x < 0) {
                        clearInterval(timer)
                        n = 0
                        next_rest = randomFrom(30, 100)
                        next_rest_time = randomFrom(10, 60)
                        console.log('继续')
                        this.keepGoing()
                    } else {
                        console.log(`\r程序将在${x}s 后继续`);
                    }
                }, 1000)

            } else {
                setTimeout(() => {
                    this.keepGoing()
                }, randomFrom(900, 1200))
            }
        })
    }
    find_piece_and_board(data) {
        // '''
        // 寻找关键坐标
        // '''
        let w = Number(data.size.w)
        let h = Number(data.size.h)
        let piece_x_sum = 0
        let piece_x_c = 0
        let piece_y_max = 0
        let board_x = 0
        let board_y = 0
        let scan_x_border = int(w / 8) //# 扫描棋子时的左右边界
        let scan_start_y = 0 //# 扫描的起始 y 坐标
        let im_pixel = data.img
        //# 以 50px 步长，尝试探测 scan_start_y
        for (let i = int(h / 3); i < int(h * 2 / 3); i += 50) {
            let last_pixel = im_pixel.getPixel(0, i)
            for (let j = 1; j < w; j++) {
                let pixel = im_pixel.getPixel(j, i)
                //# 不是纯色的线，则记录 scan_start_y 的值，准备跳出循环
                if (pixel['r'] != last_pixel['r'] || pixel['g'] != last_pixel['g'] || pixel['b'] != last_pixel['b']) {
                    scan_start_y = i - 50
                    break
                }
            }
            if (scan_start_y) {
                break
            }
        }
        //# 从 scan_start_y 开始往下扫描，棋子应位于屏幕上半部分，这里暂定不超过 2/3
        for (let i = scan_start_y; i < int(h * 2 / 3); i++) {
            for (let j = int(scan_x_border); j < int(w - scan_x_border); j++) { // # 横坐标方面也减少了一部分扫描开销
                let pixel = im_pixel.getPixel(j, i)
                if ((50 < pixel['r'] && pixel['r'] < 60) && (53 < pixel['g'] && pixel['g'] < 63) && (95 < pixel['b'] && pixel['b'] < 110)) {
                    piece_x_sum += int(j)
                    piece_x_c += 1
                    piece_y_max = i > piece_y_max ? i : piece_y_max
                }
            }
        }
        if (!piece_x_sum && !piece_x_c) {
            return [0, 0, 0, 0]
        }
        let piece_x = int(piece_x_sum / piece_x_c)
        let piece_y = int(piece_y_max) - int(piece_base_height_1_2) //# 上移棋子底盘高度的一半
        let board_x_start = null,
            board_x_end = null
        //# 限制棋盘扫描的横坐标，避免音符 bug
        if (piece_x < w / 2) {
            board_x_start = piece_x
            board_x_end = w

        } else {
            board_x_start = 0
            board_x_end = piece_x
        }
        let i
        for (i = int(h / 3); i < int(h * 2 / 3); i++) {
            let last_pixel = im_pixel.getPixel(0, i)
            if (board_x || board_y) {
                break
            }
            let board_x_sum = 0
            let board_x_c = 0
            for (let j = int(board_x_start); j < int(board_x_end); j++) {
                let pixel = im_pixel.getPixel(j, i)
                // # 修掉脑袋比下一个小格子还高的情况的 bug
                if (abs(j - piece_x) < piece_body_width) {
                    continue
                }
                // # 修掉圆顶的时候一条线导致的小 bug，这个颜色判断应该 OK，暂时不提出来
                if (abs(pixel['r'] - last_pixel['r']) + abs(pixel['g'] - last_pixel['g']) + abs(pixel['b'] - last_pixel['b']) > 10) {
                    board_x_sum += Number(j)
                    board_x_c += 1
                }
            }
            if (board_x_sum) {
                board_x = int(board_x_sum / board_x_c)
            }
        }
        let last_pixel = im_pixel.getPixel(board_x, i)

        // # 从上顶点往下 +274 的位置开始向上找颜色与上顶点一样的点，为下顶点
        // # 该方法对所有纯色平面和部分非纯色平面有效，对高尔夫草坪面、木纹桌面、药瓶和非菱形的碟机（好像是）会判断错误
        let k
        for (k = (Number(i) + 274); k > i; k--) { //# 274 取开局时最大的方块的上下顶点距离
            let pixel = im_pixel.getPixel(board_x, k)
            if (abs(pixel['r'] - last_pixel['r']) + abs(pixel['g'] - last_pixel['g']) + abs(pixel['b'] - last_pixel['b']) < 10) {
                break
            }
        }
        board_y = int((Number(i) + Number(k)) / 2)
        // # 如果上一跳命中中间，则下个目标中心会出现 r245 g245 b245 的点，利用这个属性弥补上一段代码可能存在的判断错误
        // # 若上一跳由于某种原因没有跳到正中间，而下一跳恰好有无法正确识别花纹，则有可能游戏失败，由于花纹面积通常比较大，失败概率较低
        for (let l = Number(i); l < Number(i) + 200; l++) {
            let pixel = im_pixel.getPixel(board_x, l)
            if (abs(pixel['r'] - 245) + abs(pixel['g'] - 245) + abs(pixel['b'] - 245) == 0) {
                board_y = l + 10
                break
            }
        }
        if (!board_x && !board_y) {
            return [0, 0, 0, 0]
        }

        return {
            piece_x,
            piece_y,
            board_x,
            board_y
        }
    }
}

new Autojumping()

