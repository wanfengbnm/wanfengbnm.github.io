<script lang="ts">
</script>

<template>
    <div class="divider"></div>
    <br>
    <div class="center">
        <img src="/img/test5.jpg" class="picture" />
        <img src="/img/test2.jpg" class="picture" />
    </div>
    <div class="center">
        <img src="/img/test3.jpg" class="picture" />
        <img src="/img/test4.jpg" class="picture" />
    </div>
</template>

<style lang="css" scoped>
.divider {
    margin: 24px auto 18px;
    width: 300px;
    height: 1px;
    background-color: var(--vp-c-divider);
}

.center {
    display: flex;
    justify-content: center;
}

img.picture {
    border-radius: 25px;
    height: 300px;
    width: 500px;
}
</style>